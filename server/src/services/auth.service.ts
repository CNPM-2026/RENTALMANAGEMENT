import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { signGoogleOAuthState, signShortToken, verifyGoogleOAuthState } from '../utils/jwt';
import { createOpaqueToken, createOtp, hashToken } from '../utils/tokens';
import { mailService } from './mail.service';
import { Role } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';

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

    const user = await prisma.user.upsert({
      where: { email: payload.email.toLowerCase() },
      update: {
        isActive: true,
        isEmailVerified: true,
        avatarUrl: payload.picture,
        fullName: payload.name || payload.email,
      },
      create: {
        email: payload.email.toLowerCase(),
        passwordHash: hashToken(createOpaqueToken()),
        fullName: payload.name || payload.email,
        avatarUrl: payload.picture,
        role: Role.TENANT,
        isEmailVerified: true,
      },
    });

    const token = signShortToken({ id: user.id, role: user.role });
    const refreshToken = createOpaqueToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const { passwordHash, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token, refreshToken };
  },
  // 1. Đăng ký
  register: async (data: any) => {
    const { email, password, fullName, phone, role } = data;

    // Check email tồn tại
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('Email này đã được sử dụng', 400);
    }

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Keep registration and initial delivery atomic: a failed mail must not
    // leave an account that can never complete the signup flow.
    return prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
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
  },

  // 2. Đăng nhập
  login: async (email: string, password: string) => {
    // Tìm user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }
    if (!user.isEmailVerified) {
      throw new AppError('Vui lòng xác minh email trước khi đăng nhập', 403);
    }

    // So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    // Tạo token
    const token = signShortToken({ id: user.id, role: user.role });
    const refreshToken = createOpaqueToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Xóa passwordHash trước khi trả về
    const { passwordHash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token, refreshToken };
  },

  refresh: async (refreshToken: string) => {
    const tokenHash = hashToken(refreshToken);
    const nextRefreshToken = createOpaqueToken();
    const result = await prisma.$transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
      if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || !stored.user.isActive || !stored.user.isEmailVerified) {
        throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401);
      }

      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new AppError('Refresh token đã được sử dụng', 401);
      }

      await tx.refreshToken.create({
        data: { userId: stored.userId, tokenHash: hashToken(nextRefreshToken), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
      return { user: stored.user, refreshToken: nextRefreshToken };
    });
    return { token: signShortToken({ id: result.user.id, role: result.user.role }), refreshToken: result.refreshToken };
  },

  logout: async (refreshToken: string) => {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  },

  requestPasswordReset: async (email: string) => {
    const user = await prisma.user.findUnique({ where: { email } });
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
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isEmailVerified: true } });
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