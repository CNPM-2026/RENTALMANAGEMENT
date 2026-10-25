import { Request, Response } from 'express';
import { authService } from '../services/auth.service';

export const authController = {
  register: async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      data: result,
    });
  },

  login: async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: result,
    });
  },

  getMe: async (req: any, res: Response) => {
    // req.user được gắn từ middleware auth
    res.status(200).json({
      success: true,
      message: 'Lấy thông tin cá nhân thành công',
      data: req.user,
    });
  }
};