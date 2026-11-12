export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  /**
   * Mã lỗi máy đọc được (vd. `OTP_INVALID`). Chỉ `errorHandler` trả ra ngoài và
   * chỉ với AppError, nên mã nội bộ của Prisma không bao giờ lộ qua đây.
   */
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}