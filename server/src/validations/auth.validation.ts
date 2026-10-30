import { z } from 'zod';

// Validate cho Đăng ký
export const registerSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  fullName: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(50, 'Họ tên quá dài'),
  phone: z.string()
    .regex(/(84|0[3|5|7|8|9])+([0-9]{8})\b/, 'Số điện thoại không hợp lệ (VD: 0912345678)')
    .optional()
    .or(z.literal('')), // Cho phép chuỗi rỗng
  role: z.enum(['TENANT', 'LANDLORD', 'AGENT']).optional(), // Admin không cho phép đăng ký tự do
});

// Validate cho Đăng nhập
export const loginSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const refreshTokenSchema = z.object({ refreshToken: z.string().min(20) });
export const forgotPasswordSchema = z.object({ email: z.string().email() });
export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(6),
});