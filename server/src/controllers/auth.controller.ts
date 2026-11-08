
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { auditService } from '../services/audit.service';
import prisma from '../config/db';
import { env } from '../config/env';

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

  verifyEmail: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.verifyEmail(req.body.email, req.body.code);
      return res.json({ success: true, message: 'Xác minh email thành công' });
    } catch (error) { return next(error); }
  },

  resendVerification: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({ where: { email: req.body.email }, select: { id: true, email: true } });
      if (user) await authService.sendEmailVerification(user.id, user.email);
      return res.json({ success: true, message: 'Nếu email tồn tại, mã xác minh mới đã được gửi' });
    } catch (error) { return next(error); }
  },

  googleRedirect: (req: Request, res: Response) => {
    res.redirect(authService.googleAuthorizationUrl());
  },

  googleCallback: async (req: Request, res: Response) => {
    try {
      const result = await authService.loginWithGoogle(
        String(req.query.code || ''),
        String(req.query.state || ''),
      );
      const params = new URLSearchParams({
        token: result.token,
        refreshToken: result.refreshToken,
      });
      res.redirect(`${env.FRONTEND_URL}/login#google=${encodeURIComponent(params.toString())}`);
    } catch {
      res.redirect(`${env.FRONTEND_URL}/login?googleError=1`);
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
