import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { signShortToken } from '../utils/jwt';
import { createOpaqueToken, hashToken } from '../utils/tokens';
import { mailService } from './mail.service';
import { Role } from '@prisma/client';

export const authService = {
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

    // Tạo user trong DB
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone,
        role: role as Role || Role.TENANT, // Mặc định là TENANT
      },
      select: {
        id: true, email: true, fullName: true, role: true, createdAt: true
      } // Không trả về passwordHash
    });

    return newUser;
  },

  // 2. Đăng nhập
  login: async (email: string, password: string) => {
    // Tìm user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
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
      if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || !stored.user.isActive) {
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

  resetPassword: async (token: string, password: string) => {
    const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw new AppError('Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', 400);
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  },
};