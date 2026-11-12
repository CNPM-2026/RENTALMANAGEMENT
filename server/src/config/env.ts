import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
});

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET phải dài ít nhất 32 ký tự để bảo mật'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  MAIL_PROVIDER: z.enum(['resend', 'mailtrap', 'gmail']).default('resend'),
  RESET_PASSWORD_URL: z.string().url().default('http://localhost:3001/reset-password'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  CLIENT_ID: z.string().optional(),
  CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:3000/api/v1/auth/google/callback'),
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),
  // H-05/OTP: pepper riêng cho HMAC của mã OTP (>= 32 ký tự). Cố tình OPTIONAL ở
  // mức boot để không chặn toàn bộ server; nếu thiếu, luồng OTP fail closed (503).
  OTP_PEPPER: z.string().optional(),
  // Chuỗi rỗng được coi là "chưa cấu hình" (mặc định 1) thay vì làm sập boot.
  OTP_PEPPER_VERSION: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
}).superRefine((config, context) => {
  const cloudinaryValues = [
    config.CLOUDINARY_CLOUD_NAME,
    config.CLOUDINARY_API_KEY,
    config.CLOUDINARY_API_SECRET,
  ];
  const hasSomeCloudinaryConfig = cloudinaryValues.some(Boolean);
  const hasAllCloudinaryConfig = cloudinaryValues.every(Boolean);

  if (hasSomeCloudinaryConfig && !hasAllCloudinaryConfig) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CLOUDINARY'],
      message: 'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY và CLOUDINARY_API_SECRET phải được cấu hình cùng nhau.',
    });
  }

  if (config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET
    && config.CLOUDINARY_API_KEY === config.CLOUDINARY_API_SECRET) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CLOUDINARY_API_SECRET'],
      message: 'CLOUDINARY_API_SECRET phải là API secret riêng trong Cloudinary, không phải API key.',
    });
  }

  // H-05/OTP: pepper phải là secret riêng và đủ mạnh. Chuỗi rỗng được coi là
  // "chưa cấu hình" (luồng OTP trả 503), còn giá trị quá ngắn hoặc trùng secret
  // khác là cấu hình SAI nên chặn ngay lúc khởi động.
  const otpPepper = config.OTP_PEPPER?.trim();
  if (otpPepper && otpPepper.length < 32) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['OTP_PEPPER'],
      message: 'OTP_PEPPER phải dài ít nhất 32 ký tự.',
    });
  }
  if (otpPepper && (otpPepper === config.JWT_SECRET || otpPepper === config.DB_URL)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['OTP_PEPPER'],
      message: 'OTP_PEPPER phải là chuỗi bí mật riêng, không được trùng JWT_SECRET hoặc DB_URL.',
    });
  }
});

// Thử parse các biến môi trường, nếu thiếu hay sai định dạng sẽ báo đỏ ngay lúc khởi động
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Lỗi cấu hình biến môi trường:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
