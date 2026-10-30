
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { auditService } from '../services/audit.service';

export const authController = {
  register: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await authService.register(req.body);
      await auditService.record({
        userId: result.id,
        action: 'REGISTER',
        entityType: 'USER',
        entityId: result.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

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
      await auditService.record({
        userId: result.user.id,
        action: 'LOGIN',
        entityType: 'USER',
        entityId: result.user.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(200).json({
        success: true,
        message: 'Đăng nhập thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  refresh: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.refresh(req.body.refreshToken);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  logout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.logout(req.body.refreshToken);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },

  forgotPassword: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.requestPasswordReset(req.body.email);
      return res.status(202).json({ success: true, message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi' });
    } catch (error) {
      return next(error);
    }
  },

  resetPassword: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.resetPassword(req.body.token, req.body.password);
      return res.status(200).json({ success: true, message: 'Đặt lại mật khẩu thành công' });
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
