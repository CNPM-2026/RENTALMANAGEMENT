import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(10, 'JWT_SECRET phải dài ít nhất 10 ký tự để bảo mật'),
});

// Thử parse các biến môi trường, nếu thiếu hay sai định dạng sẽ báo đỏ ngay lúc khởi động
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Lỗi cấu hình biến môi trường:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;