import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export const mailService = {
  sendPasswordReset: async (email: string, token: string) => {
    const subject = 'Đặt lại mật khẩu Rental Management';
    const resetUrl = `${env.RESET_PASSWORD_URL}?token=${encodeURIComponent(token)}`;
    const text = [
      'Bạn vừa yêu cầu đặt lại mật khẩu Rental Management.',
      '',
      `Mở liên kết sau để đặt lại mật khẩu: ${resetUrl}`,
      '',
      `Mã đặt lại mật khẩu: ${token}`,
      'Liên kết và mã có hiệu lực trong 15 phút và chỉ được sử dụng một lần.',
      'Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.',
    ].join('\n');

    if (env.MAIL_PROVIDER === 'mailtrap') {
      if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.MAIL_FROM) {
        throw new AppError('Mailtrap SMTP chưa được cấu hình đầy đủ', 503);
      }

      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      });

      await transporter.sendMail({ from: env.MAIL_FROM, to: email, subject, text });
      return;
    }

    if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
      throw new AppError('Email service chưa được cấu hình', 503);
    }

    const result = await new Resend(env.RESEND_API_KEY).emails.send({
      from: env.MAIL_FROM,
      to: email,
      subject,
      text,
    });
    if (result.error) throw new AppError('Không thể gửi email đặt lại mật khẩu', 503);
  },
};
