import rateLimit from 'express-rate-limit';

// Chặn spam đăng nhập/đăng ký: Tối đa 10 lần / 15 phút
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Giới hạn 10 request mỗi IP
  message: {
    success: false,
    message: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút!',
  },
  standardHeaders: true, // Trả về thông tin rate limit trong header
  legacyHeaders: false, // Tắt header cũ
});