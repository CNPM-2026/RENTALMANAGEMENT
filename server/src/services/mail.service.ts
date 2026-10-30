import { Resend } from 'resend';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export const mailService = {
  sendPasswordReset: async (email: string, token: string) => {
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
      throw new AppError('Email service chưa được cấu hình', 503);
    }
    const resend = new Resend(env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: env.MAIL_FROM,
      to: email,
      subject: 'Đặt lại mật khẩu Rental Management',
      text: `Mã đặt lại mật khẩu của bạn: ${token}. Mã có hiệu lực trong 15 phút.`,
    });
    if (result.error) throw new AppError('Không thể gửi email đặt lại mật khẩu', 503);
  },
};
