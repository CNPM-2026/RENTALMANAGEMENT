import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { signGoogleOAuthState, signShortToken, verifyGoogleOAuthState } from '../utils/jwt';
import { createOpaqueToken, createOtp, hashToken } from '../utils/tokens';
import { mailService } from './mail.service';
import { AmbiguousEmailError, DUMMY_PASSWORD_HASH, hasUsablePassword, NO_PASSWORD, normalizeEmail } from '../utils/email';
import { Prisma, Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { isUserEmailUniqueViolation } from '../utils/prisma-errors';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';

// `users.email` là unique index phân biệt hoa/thường, nên tra cứu phải không
// phân biệt casing để vẫn thấy các row cũ được `register` lưu nguyên văn.
// `take: 2` là đủ để phát hiện trùng lặp mà không đọc thừa dữ liệu.
const emailLookupArgs = (email: string): Prisma.UserFindManyArgs => ({
  where: { email: { equals: normalizeEmail(email), mode: 'insensitive' } },
  take: 2,
});

/**
 * Tra cứu tài khoản theo email đã chuẩn hóa. Fail closed (400) khi có nhiều row
 * trùng: không được chọn đại một row vì như vậy có thể trao phiên cho kẻ tấn công.
 */
export const findUserByEmail = async (email: string) => {
  const matches = await prisma.user.findMany(emailLookupArgs(email));
  if (matches.length > 1) throw new AmbiguousEmailError();
  return matches[0] ?? null;
};

/** Biến thể cho các luồng phải im lặng về sự tồn tại của tài khoản. */
export const findUserByEmailOrNull = async (email: string) => {
  const matches = await prisma.user.findMany(emailLookupArgs(email));
  return matches.length === 1 ? matches[0] : null;
};

/** Danh tính đã được Google xác thực (email đã verify phía Google). */
type GoogleIdentity = {
  email: string;
  fullName: string;
  avatarUrl?: string;
};

/** 1 lần thử + đúng 1 lần retry khi INSERT hụt vì xung đột `users.email`. */
const GOOGLE_RESOLVE_MAX_ATTEMPTS = 2;

/**
 * Đổi authorization code (chỉ dùng được MỘT lần) và xác thực id_token.
 * Tách riêng khỏi phần DB để retry do xung đột unique không bao giờ phải đổi lại code.
 */
const exchangeGoogleCode = async (code: string, state: string): Promise<GoogleIdentity> => {
  try {
    verifyGoogleOAuthState(state);
  } catch {
    throw new AppError('Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn', 401);
  }
  const client = getGoogleClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new AppError('Google không trả về thông tin xác thực', 401);
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID || env.CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new AppError('Tài khoản Google chưa xác minh email', 401);
  }
  return {
    email: normalizeEmail(payload.email),
    fullName: payload.name || payload.email,
    avatarUrl: payload.picture,
  };
};

/**
 * "Claim" tài khoản đã tồn tại nhưng CHƯA xác minh email: Google vừa chứng minh
 * quyền sở hữu email, nên chuyển tài khoản sang đã xác minh, thu hồi toàn bộ
 * refresh token cũ và ghi audit — cả ba trong cùng một transaction.
 *
 * Không ghi `passwordHash` (không ghi đè mật khẩu hợp lệ đã có) và không ghi
 * `isActive` (không bao giờ tự mở khóa tài khoản bị khóa qua Google).
 */
const claimUnverifiedAccount = async (user: User, identity: GoogleIdentity): Promise<User> =>
  prisma.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: { id: user.id, isEmailVerified: false, isActive: true },
      data: {
        isEmailVerified: true,
        fullName: identity.fullName,
        avatarUrl: identity.avatarUrl,
      },
    });

    if (claimed.count !== 1) {
      // Không claim được: tài khoản vừa bị khóa, hoặc request khác đã xác minh trước.
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!current || !current.isActive) throw new AppError('Tài khoản đã bị khóa', 403);
      return current;
    }

    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'GOOGLE_ACCOUNT_CLAIMED',
        entityType: 'USER',
        entityId: user.id,
        metadata: { email: identity.email, provider: 'google' },
      },
    });

    return tx.user.findUniqueOrThrow({ where: { id: user.id } });
  });

/**
 * Phần chỉ chạm DB của luồng Google, tách khỏi `exchangeGoogleCode` để retry do
 * xung đột unique chỉ chạy lại phần này. Fail closed khi email khớp nhiều row
 * (`AmbiguousEmailError`) và không bao giờ kích hoạt lại tài khoản đã bị khóa.
 */
const resolveGoogleAccount = async (identity: GoogleIdentity, attempt = 1): Promise<User> => {
  const existing = await findUserByEmail(identity.email);

  if (!existing) {
    try {
      return await prisma.user.create({
        data: {
          email: identity.email,
          // Sentinel: tài khoản này không có mật khẩu dùng được, `login` sẽ fail closed.
          passwordHash: NO_PASSWORD,
          fullName: identity.fullName,
          avatarUrl: identity.avatarUrl,
          role: Role.TENANT,
          isEmailVerified: true,
        },
      });
    } catch (error) {
      // Chỉ retry khi hụt vì đúng unique `users.email` (request khác vừa tạo row),
      // mọi lỗi khác phải nổi lên nguyên trạng.
      if (attempt >= GOOGLE_RESOLVE_MAX_ATTEMPTS || !isUserEmailUniqueViolation(error)) throw error;
      return resolveGoogleAccount(identity, attempt + 1);
    }
  }

  // Tài khoản đã bị khóa (ban) thì không được đăng nhập, cũng không được tự mở khóa.
  if (!existing.isActive) throw new AppError('Tài khoản đã bị khóa', 403);

  if (!existing.isEmailVerified) return claimUnverifiedAccount(existing, identity);

  return prisma.user.update({
    where: { id: existing.id },
    data: { fullName: identity.fullName, avatarUrl: identity.avatarUrl },
  });
};

/** Thời gian sống của refresh token (30 ngày) — dùng chung cho mọi luồng cấp phiên. */
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Khóa row `users` bằng `SELECT ... FOR UPDATE`.
 *
 * Đây là bước khóa ĐẦU TIÊN của mọi transaction có ghi vào `refresh_tokens`, giữ
 * thứ tự khóa toàn cục luôn là `users` -> `refresh_tokens`. Nhờ vậy không hình
 * thành vòng chờ với các luồng khác cũng chạm hai bảng này (claim tài khoản
 * Google, admin khóa tài khoản, đặt lại mật khẩu).
 */
const lockUserRow = async (tx: Prisma.TransactionClient, userId: string) => {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE id = ${userId} FOR UPDATE
  `;
  return rows.length === 1;
};

/**
 * Cấp phiên mới (access token + refresh token).
 *
 * Giá trị refresh token được sinh trong RAM TRƯỚC transaction, nhưng chỉ được
 * GHI sau khi đã khóa row `users` và đọc lại trạng thái hiện tại. Nhờ vậy tài
 * khoản vừa bị khóa/xóa, hoặc vừa bị đổi mật khẩu, giữa bước đọc và bước cấp
 * phiên sẽ không nhận được phiên.
 *
 * Mọi lỗi khi đã cầm khóa đều fail closed: không retry, không map deadlock hay
 * xung đột ghi thành đăng nhập thành công — lỗi nổi lên nguyên trạng và toàn bộ
 * phần đã ghi (nếu có) bị rollback cùng transaction.
 */
const issueSession = async (userId: string, verify?: (locked: User) => void) => {
  const refreshToken = createOpaqueToken();
  const tokenHash = hashToken(refreshToken);

  const session = await prisma.$transaction(async (tx) => {
    if (!(await lockUserRow(tx, userId))) throw new AppError('Tài khoản không tồn tại', 401);
    const locked = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (!locked.isActive) throw new AppError('Tài khoản đã bị khóa', 403);
    if (!locked.isEmailVerified) throw new AppError('Vui lòng xác minh email trước khi đăng nhập', 403);
    verify?.(locked);

    // Ký token trong transaction để lỗi ký không để lại refresh token mồ côi.
    const token = signShortToken({ id: locked.id, role: locked.role });
    await tx.refreshToken.create({
      data: { userId: locked.id, tokenHash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
    });
    return { user: locked, token };
  });

  return { ...session, refreshToken };
};

export const authService = {
  googleAuthorizationUrl: () => {
    const client = getGoogleClient();
    return client.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      prompt: 'select_account',
      state: signGoogleOAuthState(),
    });
  },

  loginWithGoogle: async (code: string, state: string) => {
    // Đổi code đúng một lần; phần DB có thể retry mà không đụng lại authorization code.
    const identity = await exchangeGoogleCode(code, state);
    const resolved = await resolveGoogleAccount(identity);

    // Trạng thái tài khoản có thể đổi giữa bước phân giải và bước cấp phiên, nên
    // phiên chỉ được ghi sau khi khóa lại row users (xem `issueSession`).
    const { user, token, refreshToken } = await issueSession(resolved.id);

    const { passwordHash, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token, refreshToken };
  },
  // 1. Đăng ký
  register: async (data: any) => {
    const { email, password, fullName, phone, role } = data;
    const normalizedEmail = normalizeEmail(email);

    // Check email tồn tại (không phân biệt hoa/thường; ném 400 nếu trùng lặp)
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError('Email này đã được sử dụng', 400);
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Keep registration and initial delivery atomic: a failed mail must not
    // leave an account that can never complete the signup flow.
    try {
      return await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            fullName,
            phone,
            role: role as Role || Role.TENANT,
          },
          select: {
            id: true, email: true, fullName: true, role: true, createdAt: true
          }
        });
        const code = createOtp();
        await tx.emailVerificationCode.create({
          data: {
            userId: newUser.id,
            codeHash: hashToken(code),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
        await mailService.sendEmailVerification(newUser.email, code);
        return newUser;
      });
    } catch (error) {
      // TOCTOU giữa bước kiểm tra và INSERT: giữ nguyên contract 400 của luồng
      // register, không để error middleware trả 409 kèm tên index unique.
      if (isUserEmailUniqueViolation(error)) {
        throw new AppError('Email này đã được sử dụng', 400);
      }
      throw error;
    }
  },

  // 2. Đăng nhập
  login: async (email: string, password: string) => {
    // Email trùng lặp (khác casing) trả về null -> fail closed với lỗi chung bên dưới.
    const user = await findUserByEmailOrNull(email);

    // Luôn chạy đúng một lần bcrypt compare, kể cả khi không tìm thấy tài khoản
    // hoặc tài khoản không có mật khẩu dùng được (tạo qua Google), để thời gian
    // phản hồi không tiết lộ trạng thái tài khoản.
    const candidateHash = user && hasUsablePassword(user.passwordHash) ? user.passwordHash : DUMMY_PASSWORD_HASH;
    const isMatch = await bcrypt.compare(password, candidateHash);

    if (!user || !user.isActive) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }
    if (!user.isEmailVerified) {
      throw new AppError('Vui lòng xác minh email trước khi đăng nhập', 403);
    }
    if (!isMatch) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    // Cấp phiên: refresh token chỉ được ghi sau khi khóa row users và kiểm tra
    // lại trạng thái + hash mật khẩu đã dùng để so khớp ở trên (chống trường hợp
    // mật khẩu hoặc trạng thái bị đổi giữa hai bước).
    const { user: sessionUser, token, refreshToken } = await issueSession(user.id, (locked) => {
      if (!hasUsablePassword(locked.passwordHash) || locked.passwordHash !== candidateHash) {
        throw new AppError('Email hoặc mật khẩu không đúng', 401);
      }
    });

    // Xóa passwordHash trước khi trả về
    const { passwordHash, ...userWithoutPassword } = sessionUser;

    return { user: userWithoutPassword, token, refreshToken };
  },

  refresh: async (refreshToken: string) => {
    const tokenHash = hashToken(refreshToken);
    // Giá trị mới sinh trong RAM trước transaction; chỉ ghi sau khi đã khóa users.
    const nextRefreshToken = createOpaqueToken();
    const nextTokenHash = hashToken(nextRefreshToken);

    return prisma.$transaction(async (tx) => {
      // Đọc KHÔNG khóa, chỉ để biết chủ sở hữu. Không được claim refresh token
      // trước khi khóa users: thứ tự khóa toàn cục là users -> refresh_tokens.
      const stored = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
        throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401);
      }

      if (!(await lockUserRow(tx, stored.userId))) {
        throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401);
      }
      // Đọc lại SAU khi khóa: trạng thái ở đây là trạng thái đã commit mới nhất.
      const user = await tx.user.findUnique({ where: { id: stored.userId } });
      if (!user || !user.isActive || !user.isEmailVerified) {
        throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401);
      }

      // Claim token cũ và tạo token mới trong CÙNG transaction: bước sau lỗi thì
      // token cũ không bị thu hồi, nên không bao giờ có rotation nửa chừng.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new AppError('Refresh token đã được sử dụng', 401);
      }

      await tx.refreshToken.create({
        data: { userId: user.id, tokenHash: nextTokenHash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
      });

      return { token: signShortToken({ id: user.id, role: user.role }), refreshToken: nextRefreshToken };
    });
  },

  logout: async (refreshToken: string) => {
    // Chỉ chạm `refresh_tokens`: cố tình KHÔNG đọc hay khóa `users`, để logout
    // không tạo phụ thuộc khóa refresh_tokens -> users (ngược thứ tự toàn cục).
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  },

  requestPasswordReset: async (email: string) => {
    const user = await findUserByEmailOrNull(email);
    if (!user || !user.isActive) return;
    const token = createOpaqueToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    });
    await mailService.sendPasswordReset(user.email, token);
  },

  sendEmailVerification: async (userId: string, email?: string) => {
    await prisma.$transaction(async (tx) => {
      const lockedUsers = await tx.$queryRaw<Array<{ id: string; email: string; is_email_verified: boolean }>>`
        SELECT id, email, is_email_verified
        FROM users
        WHERE id = ${userId}
        FOR UPDATE
      `;
      const user = lockedUsers[0];
      if (!user) throw new AppError('Không tìm thấy tài khoản', 404);
      if (user.is_email_verified) return;

      const code = createOtp();
      await tx.emailVerificationCode.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.emailVerificationCode.create({
        data: { userId: user.id, codeHash: hashToken(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
      });
      await mailService.sendEmailVerification(email ?? user.email, code);
    });
  },

  verifyEmail: async (email: string, code: string) => {
    const user = await findUserByEmailOrNull(email);
    if (!user) throw new AppError('Mã xác minh không hợp lệ hoặc đã hết hạn', 400);
    if (user.isEmailVerified) return;
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationCode.updateMany({
        where: {
          userId: user.id,
          codeHash: hashToken(code),
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new AppError('Mã xác minh không hợp lệ hoặc đã hết hạn', 400);
      await tx.user.update({
        where: { id: user.id, isEmailVerified: false },
        data: { isEmailVerified: true },
      });
    });
  },

  resetPassword: async (token: string, password: string) => {
    const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw new AppError('Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', 400);
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: reset.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new AppError('Mã đặt lại mật khẩu đã được sử dụng hoặc đã hết hạn', 400);
      }
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  },
};

function getGoogleClient() {
  const clientId = env.GOOGLE_CLIENT_ID || env.CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET || env.CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new AppError('Google OAuth chưa được cấu hình đầy đủ', 503);
  }
  return new OAuth2Client(clientId, clientSecret, env.GOOGLE_REDIRECT_URI);
}