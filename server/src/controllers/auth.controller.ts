
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

export const authController = {
  register: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await authService.register(req.body);

      return res.status(201).json({
        success: true,
        message: 'Đăng ký tài khoản thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  login: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { email, password } = req.body;

      const result = await authService.login(email, password);

      return res.status(200).json({
        success: true,
        message: 'Đăng nhập thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getMe: (req: Request, res: Response) => {
    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin cá nhân thành công',
      data: (req as any).user,
    });
  },
};
