import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { signToken } from '../utils/jwt';
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
    const token = signToken({ id: user.id, role: user.role });

    // Xóa passwordHash trước khi trả về
    const { passwordHash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  },
};