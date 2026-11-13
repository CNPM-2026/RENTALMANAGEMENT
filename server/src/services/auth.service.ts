import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { signGoogleOAuthState, signShortToken, verifyGoogleOAuthState } from '../utils/jwt';
import { createOpaqueToken, createOtp, hashToken } from '../utils/tokens';
import { hashOtp, otpHashMatches, OTP_HMAC_VERSION, OTP_MAX_ATTEMPTS, OTP_PURPOSE, OTP_TTL_MS } from '../utils/otp';
import { mailService } from './mail.service';
import { issuePasswordSetupGrant, passwordSetupGrantInvalidError, verifyPasswordSetupGrant } from '../utils/passwordSetupGrant';
import { AmbiguousEmailError, DUMMY_PASSWORD_HASH, hasUsablePassword, NO_PASSWORD, normalizeEmail } from '../utils/email';
import { Prisma, Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { isUserEmailUniqueViolation } from '../utils/prisma-errors';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { invalidateSocketsForRefreshToken, invalidateUserSockets } from '../socket/sessionInvalidation';

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

/**
 * H-05/OTP: MỘT lỗi duy nhất cho mọi thất bại của luồng xác minh email.
 *
 * Dùng chung cho: email không tồn tại, email trùng nhiều row, mã sai, mã hết hạn,
 * mã đã dùng, sai purpose, row cũ không có `hmac_version`, và cả tài khoản đã xác
 * minh/đang bị khóa. Nhờ vậy response không còn là oracle trạng thái tài khoản.
 *
 * 400 (không phải 401/403): client chỉ coi 401 là phiên hết hạn và tự chuyển
 * trang khi gặp 403, nên 400 giữ đúng ngữ nghĩa "dữ liệu gửi lên không đúng".
 */
const invalidOtpError = () =>
  new AppError('Mã xác minh không hợp lệ hoặc đã hết hạn', 400, 'OTP_INVALID');

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
 * H-05: mật khẩu do `register` tạo ra CHƯA từng được chứng minh qua hộp thư
 * (`passwordProvenAt === null`), nên nó không được sống sót qua bước xác minh
 * hộp thư này. Nếu vẫn là hash dùng được, nó bị thay bằng sentinel `NO_PASSWORD`
 * (idempotent: lần chạy sau sentinel không còn "usable" nên không đổi gì).
 * Mật khẩu đã được chứng minh (vd. đặt lại qua email) được giữ nguyên.
 *
 * Không ghi `isActive` (không bao giờ tự mở khóa tài khoản bị khóa qua Google).
 */
const claimUnverifiedAccount = async (user: User, identity: GoogleIdentity): Promise<User> => {
  const claim = await prisma.$transaction(async (tx) => {
    // Khóa row users TRƯỚC khi đọc trạng thái (thứ tự khóa toàn cục: users -> bảng con).
    if (!(await lockUserRow(tx, user.id))) throw new AppError('Tài khoản không tồn tại', 401);
    const locked = await tx.user.findUniqueOrThrow({ where: { id: user.id } });

    if (!locked.isActive) throw new AppError('Tài khoản đã bị khóa', 403);
    // Request khác đã claim trước: không thu hồi token, không ghi audit.
    if (locked.isEmailVerified) return { claimed: false, user: locked };

    // Chỉ thu hồi mật khẩu chưa từng được chứng minh. Đánh giá trên row đã khóa.
    const retirePassword = locked.passwordProvenAt === null && hasUsablePassword(locked.passwordHash);

    await tx.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        fullName: identity.fullName,
        avatarUrl: identity.avatarUrl,
        authVersion: { increment: 1 },
        ...(retirePassword ? { passwordHash: NO_PASSWORD, passwordSetVia: null } : {}),
      },
    });

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
        metadata: { email: identity.email, provider: 'google', passwordRetired: retirePassword },
      },
    });

    return { claimed: true, user: await tx.user.findUniqueOrThrow({ where: { id: user.id } }) };
  });

  // H-05/Batch 2B2.2 (L1.2): chỉ đóng socket SAU khi transaction trên đã commit —
  // rollback/lỗi ném ra ngoài nên không bao giờ chạy tới đây với dữ liệu chưa ghi.
  // Nhánh "đã xác minh email từ trước" không tăng `authVersion` nên không đóng gì.
  if (claim.claimed) invalidateUserSockets(claim.user.id);

  return claim.user;
};

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

/**
 * Thời gian sống TỐI ĐA của một phiên đăng nhập: 2 giờ.
 *
 * Đây là hạn TUYỆT ĐỐI tính từ lần đăng nhập, không phải hạn trượt: mỗi lần
 * rotate refresh token, token mới giữ nguyên `expiresAt` của token gốc (xem
 * `refresh`), nên người dùng không thể gia hạn phiên vô hạn bằng cách gọi
 * `/auth/refresh` liên tục.
 */
const REFRESH_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

/** Phiên cũ (phát trước khi áp hạn 2 giờ) không được sống lâu hơn hạn mới. */
const refreshTokenExpiry = (sessionExpiresAt: Date) =>
  new Date(Math.min(sessionExpiresAt.getTime(), Date.now() + REFRESH_TOKEN_TTL_MS));

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

    // Ký token trong transaction để lỗi ký không để lại refresh token mồ côi, và
    // để `av` mang đúng `authVersion` của row vừa đọc SAU khi giữ khóa.
    const token = signShortToken({ id: locked.id, role: locked.role, av: locked.authVersion });
    await tx.refreshToken.create({
      data: { userId: locked.id, tokenHash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
    });
    return { user: locked, token };
  });

  return { ...session, refreshToken };
};

/**
 * H-05/Batch 2B1: lõi dùng chung của mọi luồng "thiết lập mật khẩu có chủ đích".
 *
 * Hiện chỉ luồng `setPassword` (grant sau khi xác minh email) gọi vào; luồng
 * "người dùng Google đang có phiên hợp lệ" sau này sẽ tái dùng đúng hàm này với
 * `expectedAuthVersion: null` và error riêng, nên logic khóa/ghi/audit chỉ tồn tại
 * ở một chỗ.
 *
 * Bất biến:
 *  - khóa row `users` TRƯỚC khi đọc trạng thái và trước mọi bảng con
 *    (thứ tự toàn cục: users -> refresh_tokens -> audit_logs),
 *  - mọi quyết định đọc trên row ĐÃ khóa,
 *  - `authVersion` +1 trong CÙNG transaction với hash mới, nên mọi quyết định
 *    credential đang bay (refresh token, grant) trở nên cũ ngay lập tức,
 *  - thu hồi toàn bộ refresh token còn sống,
 *  - audit không bao giờ chứa mật khẩu, hash, OTP hay token.
 *
 * `expectedAuthVersion === null` nghĩa là "bỏ qua kiểm tra phiên bản" (luồng đã có
 * phiên hợp lệ). Luồng grant LUÔN truyền phiên bản đã ký, nhờ vậy mỗi grant chỉ
 * đổi được mật khẩu đúng một lần.
 */
const establishPassword = async (
  userId: string,
  passwordHash: string,
  options: {
    expectedAuthVersion: number | null;
    provenance: { provenVia: string; setVia: string };
    invalidError: () => AppError;
  },
) => {
  const { expectedAuthVersion, provenance, invalidError } = options;

  await prisma.$transaction(async (tx) => {
    if (!(await lockUserRow(tx, userId))) throw invalidError();

    const locked = await tx.user.findUnique({ where: { id: userId } });
    // Tài khoản bị khóa hoặc chưa xác minh email thì không bao giờ được đặt mật
    // khẩu: xác minh email là điều kiện tiên quyết của quyền sở hữu hộp thư.
    if (!locked || !locked.isActive || !locked.isEmailVerified) throw invalidError();

    // Chống replay: grant mang `authVersion` tại thời điểm phát, phải trùng với
    // giá trị đọc được SAU khi giữ khóa. Lần đặt mật khẩu thành công tăng
    // `authVersion`, nên lần dùng lại thứ hai luôn thất bại.
    if (expectedAuthVersion !== null && locked.authVersion !== expectedAuthVersion) throw invalidError();

    const now = new Date();
    await tx.user.update({
      where: { id: locked.id },
      data: {
        passwordHash,
        // Mật khẩu được thiết lập ngay sau khi chủ hộp thư chứng minh quyền sở hữu
        // email, nên hash này là "đã chứng minh" và sẽ KHÔNG bị thu hồi nếu hộp thư
        // được xác minh lặp lại (idempotent, ví dụ qua Google claim).
        passwordProvenAt: now,
        passwordProvenVia: provenance.provenVia,
        passwordSetVia: provenance.setVia,
        authVersion: { increment: 1 },
      },
    });

    await tx.refreshToken.updateMany({
      where: { userId: locked.id, revokedAt: null },
      data: { revokedAt: now },
    });

    await tx.auditLog.create({
      data: {
        userId: locked.id,
        action: 'PASSWORD_SET',
        entityType: 'USER',
        entityId: locked.id,
        metadata: { method: provenance.setVia, provenVia: provenance.provenVia },
      },
    });
  });

  // H-05/Batch 2B2.2 (L1.2): transaction đã COMMIT (mọi lỗi phía trên đều ném ra
  // ngoài và rollback), nên mọi socket đang mở mang `authVersion` cũ của user bị
  // đóng ngay tại đây thay vì chờ event kế tiếp.
  invalidateUserSockets(userId);
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

    // H-05: không trả metadata credential (provenance/version) ra HTTP response.
    const { passwordHash, authVersion, passwordProvenAt, passwordProvenVia, passwordSetVia, ...userWithoutPassword } = user;
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
            // H-05: mật khẩu do đăng ký tạo ra chưa từng được chứng minh qua hộp thư.
            passwordSetVia: 'REGISTER',
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
            purpose: OTP_PURPOSE.SIGNUP_VERIFY,
            codeHash: hashOtp(code, OTP_PURPOSE.SIGNUP_VERIFY),
            hmacVersion: OTP_HMAC_VERSION,
            attempts: 0,
            maxAttempts: OTP_MAX_ATTEMPTS,
            expiresAt: new Date(Date.now() + OTP_TTL_MS),
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
    const { passwordHash, authVersion, passwordProvenAt, passwordProvenVia, passwordSetVia, ...userWithoutPassword } = sessionUser;

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
        // Hạn TUYỆT ĐỐI của phiên: kế thừa token gốc, KHÔNG cộng thêm 2 giờ.
        // Nhờ vậy refresh nhiều lần cũng không thể kéo dài phiên quá 2 giờ.
        data: { userId: user.id, tokenHash: nextTokenHash, expiresAt: refreshTokenExpiry(stored.expiresAt) },
      });

      // `av` lấy từ row users VỪA đọc lại sau khi khóa, nên refresh không bao giờ
      // hồi sinh một phiên mang phiên bản credential cũ.
      return { token: signShortToken({ id: user.id, role: user.role, av: user.authVersion }), refreshToken: nextRefreshToken };
    });
  },

  logout: async (refreshToken: string) => {
    // Chỉ chạm `refresh_tokens`: cố tình KHÔNG đọc hay khóa `users`, để logout
    // không tạo phụ thuộc khóa refresh_tokens -> users (ngược thứ tự toàn cục).
    const tokenHash = hashToken(refreshToken);
    const revoked = await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // H-05/Batch 2B2.3 (finding L1.2-a): câu UPDATE trên là (và vẫn là) thao tác ghi
    // nguyên tử duy nhất của logout — nó resolve tức là đã COMMIT, nên đây chính là
    // điểm "sau commit" an toàn để đóng socket. Chỉ khi nó THỰC SỰ thu hồi được token
    // (`count === 1`) mới đóng socket của chủ token: token không tồn tại hoặc đã bị thu
    // hồi (replay, hoặc đã rotate xong) trả `count === 0` nên không thể bị dùng để đá
    // phiên của người khác. Việc tra `userId` nằm trong socket layer (chỉ đọc
    // `refresh_tokens`, không đọc `users`) để giữ nguyên bất biến thứ tự khóa ở trên.
    if (revoked.count === 1) await invalidateSocketsForRefreshToken(tokenHash);
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

  // 5. Gửi (lại) mã xác minh email
  sendEmailVerification: async (userId: string) => {
    // `userId` chỉ là gợi ý từ nơi gọi: trạng thái tài khoản được đọc lại SAU khi
    // khóa row, không dựa vào object đọc trước đó.
    const code = createOtp();
    const codeHash = hashOtp(code, OTP_PURPOSE.SIGNUP_VERIFY);

    await prisma.$transaction(async (tx) => {
      // Thứ tự khóa toàn cục: users -> email_verification_codes.
      if (!(await lockUserRow(tx, userId))) return;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, isActive: true, isEmailVerified: true },
      });
      // Không tồn tại / bị khóa / đã xác minh: im lặng (nơi gọi trả thông điệp
      // chung) để resend không trở thành oracle trạng thái tài khoản.
      if (!user || !user.isActive || user.isEmailVerified) return;

      // Đốt mọi challenge còn sống của CÙNG purpose trước khi phát mã mới, nhờ vậy
      // tại một thời điểm chỉ có tối đa một OTP SIGNUP_VERIFY có thể tiêu thụ.
      await tx.emailVerificationCode.updateMany({
        where: { userId: user.id, purpose: OTP_PURPOSE.SIGNUP_VERIFY, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.emailVerificationCode.create({
        data: {
          userId: user.id,
          purpose: OTP_PURPOSE.SIGNUP_VERIFY,
          codeHash,
          hmacVersion: OTP_HMAC_VERSION,
          attempts: 0,
          maxAttempts: OTP_MAX_ATTEMPTS,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      });
      // Gửi tới địa chỉ đọc từ row đã khóa (không dùng email do nơi gọi truyền vào).
      await mailService.sendEmailVerification(user.email, code);
    });
  },

  // 6. Xác minh email bằng OTP
  // Trả về "password-setup grant" hẹp (xem `utils/passwordSetupGrant.ts`) chứ KHÔNG
  // cấp phiên đăng nhập: chứng minh quyền sở hữu hộp thư chỉ cho phép ĐẶT mật khẩu.
  verifyEmail: async (email: string, code: string) => {
    // Email trong request chỉ là gợi ý tra cứu (untrusted hint). Mọi quyết định
    // dưới đây dựa trên row `users` đã khóa, và email được đối chiếu lại với row đó.
    const normalizedEmail = normalizeEmail(email);
    // Băm HMAC TRƯỚC khi biết tài khoản có tồn tại hay không: cả hai nhánh cùng
    // thực hiện một phép tính, giảm chênh lệch thời gian phản hồi.
    const presentedHash = hashOtp(code, OTP_PURPOSE.SIGNUP_VERIFY);

    const hint = await findUserByEmailOrNull(normalizedEmail);
    if (!hint) throw invalidOtpError();

    // `null` = thất bại. Transaction trả về bình thường (commit) ở cả nhánh sai, vì
    // lượt thử sai đã được ghi trong transaction và PHẢI được giữ lại.
    const outcome = await prisma.$transaction(async (tx) => {
      // (1) Khóa row `users` TRƯỚC mọi bảng con (users -> email_verification_codes),
      // cùng thứ tự với sendEmailVerification / claim Google / reset mật khẩu.
      if (!(await lockUserRow(tx, hint.id))) return null;

      // (2) Đọc lại trạng thái SAU khi đã giữ khóa.
      const locked = await tx.user.findUnique({ where: { id: hint.id } });
      if (!locked || normalizeEmail(locked.email) !== normalizedEmail) return null;

      // (3) Chỉ tài khoản đang hoạt động và CHƯA xác minh mới đi tiếp. Các trường
      // hợp còn lại trả về đúng một lỗi chung, không lộ trạng thái tài khoản.
      if (!locked.isActive || locked.isEmailVerified) return null;

      // (4) Khóa challenge đang sống của đúng purpose và đúng phiên bản HMAC.
      const challenges = await tx.$queryRaw<Array<{ id: string; code_hash: string }>>`
        SELECT id, code_hash
        FROM email_verification_codes
        WHERE user_id = ${locked.id}
          AND purpose::text = ${OTP_PURPOSE.SIGNUP_VERIFY}
          AND hmac_version = ${OTP_HMAC_VERSION}
          AND used_at IS NULL
          AND expires_at > now()
          AND attempts < max_attempts
        ORDER BY created_at DESC
        LIMIT 2
        FOR UPDATE
      `;
      // 0 = không có challenge hợp lệ; >1 = trạng thái bất thường -> fail closed.
      if (challenges.length !== 1) return null;
      const challenge = challenges[0];

      if (!otpHashMatches(presentedHash, challenge.code_hash)) {
        // (5) Đếm lượt sai bằng MỘT câu UPDATE nguyên tử: `attempts` lấy từ giá trị
        // đang lưu trong row, và lượt sai thứ `max_attempts` đốt luôn OTP. Không
        // đọc-rồi-ghi nên hai request đồng thời không thể vượt ngân sách.
        await tx.$queryRaw`
          UPDATE email_verification_codes
          SET attempts = attempts + 1,
              used_at = CASE WHEN attempts + 1 >= max_attempts THEN now() ELSE used_at END
          WHERE id = ${challenge.id}
            AND used_at IS NULL
            AND attempts < max_attempts
          RETURNING id
        `;
        // Trả về bình thường để lượt sai được COMMIT; lỗi ném ra sau transaction.
        return null;
      }

      // (6) Tiêu thụ OTP nguyên tử: chỉ thành công nếu row vẫn còn hiệu lực.
      const consumed = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE email_verification_codes
        SET used_at = now()
        WHERE id = ${challenge.id}
          AND used_at IS NULL
          AND expires_at > now()
          AND attempts < max_attempts
        RETURNING id
      `;
      if (consumed.length !== 1) return null;

      // (7) Chỉ thu hồi mật khẩu CHƯA từng được chứng minh qua hộp thư; mật khẩu đã
      // có provenance (vd. đặt lại qua email) được giữ nguyên.
      const retirePassword = locked.passwordProvenAt === null && hasUsablePassword(locked.passwordHash);

      // (8) Xác minh + tăng authVersion trong CÙNG một câu UPDATE.
      const verifiedUser = await tx.user.update({
        where: { id: locked.id },
        data: {
          isEmailVerified: true,
          authVersion: { increment: 1 },
          ...(retirePassword ? { passwordHash: NO_PASSWORD, passwordSetVia: null } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: locked.id,
          action: 'EMAIL_VERIFIED',
          entityType: 'USER',
          entityId: locked.id,
          metadata: { method: 'OTP', purpose: OTP_PURPOSE.SIGNUP_VERIFY, passwordRetired: retirePassword },
        },
      });

      // (9) Phát "password-setup grant" BÊN TRONG transaction, gắn với `authVersion`
      // vừa tăng. Rollback thì không có grant nào tồn tại; và vì lần đặt mật khẩu
      // thành công cũng tăng `authVersion`, grant này chỉ dùng được đúng MỘT lần.
      return {
        passwordSetupGrant: issuePasswordSetupGrant(verifiedUser.id, verifiedUser.authVersion),
      };
    });

    if (!outcome) throw invalidOtpError();

    // H-05/Batch 2B2.2 (L1.2): `outcome` khác null nghĩa là transaction đã COMMIT
    // việc tăng `authVersion`. Tài khoản chưa xác minh email thì thường chưa có
    // socket nào, nhưng mọi mutation bảo mật đều phải đi qua cùng một bất biến.
    invalidateUserSockets(hint.id);

    return outcome;
  },

  /**
   * 7. Đặt mật khẩu bằng "password-setup grant" (sau khi xác minh email).
   *
   * Thứ tự cố ý:
   *  1. verify grant (chữ ký/alg/iss/aud/purpose/hạn) — request rác không mở
   *     transaction nào,
   *  2. băm mật khẩu NGOÀI transaction — bcrypt là CPU-bound, không được giữ khóa
   *     DB trong lúc băm,
   *  3. `establishPassword` khóa row users, đọc lại trạng thái, kiểm tra
   *     `authVersion` rồi ghi hash + provenance + tăng version + thu hồi refresh
   *     token + audit trong CÙNG một transaction.
   *
   * KHÔNG cấp phiên đăng nhập: client quay về trang đăng nhập và đăng nhập bằng
   * mật khẩu vừa đặt.
   */
  setPassword: async (grant: string, newPassword: string) => {
    const { userId, authVersion } = verifyPasswordSetupGrant(grant);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await establishPassword(userId, passwordHash, {
      expectedAuthVersion: authVersion,
      // Tách rõ "được chứng minh bằng gì" và "được đặt bằng gì": quyền sở hữu hộp
      // thư được chứng minh bằng OTP xác minh email, còn hash được đặt bởi luồng
      // thiết lập mật khẩu.
      provenance: { provenVia: 'EMAIL_VERIFICATION', setVia: 'PASSWORD_SETUP' },
      invalidError: passwordSetupGrantInvalidError,
    });
  },

  resetPassword: async (token: string, password: string) => {
    const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw new AppError('Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', 400);
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction(async (tx) => {
      // H-05: khóa row users TRƯỚC khi chạm bảng con (thứ tự khóa toàn cục:
      // users -> bảng con). Trước đây reset khóa password_reset_tokens rồi mới
      // tới users, tạo chu trình khóa ngược với luồng claim/xác minh email.
      if (!(await lockUserRow(tx, reset.userId))) {
        throw new AppError('Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', 400);
      }
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
      await tx.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash,
          // H-05: đặt lại qua email chứng minh quyền sở hữu hộp thư, nên hash này
          // là "đã chứng minh" và KHÔNG bị thu hồi khi hộp thư được xác minh sau đó.
          passwordProvenAt: new Date(),
          passwordProvenVia: 'PASSWORD_RESET',
          passwordSetVia: 'PASSWORD_RESET',
          authVersion: { increment: 1 },
        },
      });
      await tx.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });

    // H-05/Batch 2B2.2 (L1.2): chỉ chạy khi transaction ở trên đã COMMIT; mọi lỗi
    // (token đã dùng, hết hạn, user không tồn tại) đều ném ra trước đó.
    invalidateUserSockets(reset.userId);
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