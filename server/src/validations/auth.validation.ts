import { z } from 'zod';
import { normalizeEmail } from '../utils/email';

// Validate cho Đăng ký
export const registerSchema = z.object({
  email: z.string().email('Email không đúng định dạng').transform(normalizeEmail),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  fullName: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(50, 'Họ tên quá dài'),
  phone: z.string()
    .regex(/(84|0[3|5|7|8|9])+([0-9]{8})\b/, 'Số điện thoại không hợp lệ (VD: 0912345678)')
    .optional()
    .or(z.literal('')), // Cho phép chuỗi rỗng
  role: z.enum(['TENANT', 'LANDLORD', 'STAFF']).optional(), // Admin không cho phép đăng ký tự do; AGENT đã bị loại bỏ
});

// Validate cho Đăng nhập
export const loginSchema = z.object({
  email: z.string().email('Email không đúng định dạng').transform(normalizeEmail),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const refreshTokenSchema = z.object({ refreshToken: z.string().min(20) });
export const forgotPasswordSchema = z.object({ email: z.string().email().transform(normalizeEmail) });
export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(6),
});
/**
 * H-05/Batch 2B1: đặt mật khẩu bằng "password-setup grant".
 *
 * Policy mật khẩu dùng đúng convention hiện có của project (`register` /
 * `reset-password` đều là `min(6)`), chỉ bổ sung `max(2048)` cho `token` vì đây
 * là route mới nhận một credential dạng chuỗi: không có token hợp lệ nào dài
 * như vậy, nên chặn sớm tránh phải verify chữ ký trên payload rác.
 */
export const setPasswordSchema = z.object({
  token: z.string().min(20).max(2048),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

export const verifyEmailSchema = z.object({
  email: z.string().email().transform(normalizeEmail),
  code: z.string().regex(/^\d{6}$/, 'Mã OTP phải gồm 6 chữ số'),
});