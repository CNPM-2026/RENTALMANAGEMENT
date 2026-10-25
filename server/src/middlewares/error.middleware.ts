import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Bắt lỗi Prisma (Unique constraint)
  if (err.code === 'P2002') {
    statusCode = 409;
    message = `Dữ liệu đã tồn tại: ${err.meta?.target}`;
  }

  // Bắt lỗi Prisma (Not found)
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Không tìm thấy dữ liệu';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};