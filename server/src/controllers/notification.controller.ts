import { NextFunction, Response } from 'express';
import { notificationService } from '../services/notification.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const notificationController = {
  getMyNotifications: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await notificationService.getMyNotifications(req.user!.id);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  getById: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await notificationService.getById(req.user!.id, String(req.params.id));
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  markAsRead: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await notificationService.markAsRead(req.user!.id, String(req.params.id));
      return res.status(200).json({ success: true, message: 'Đã đánh dấu đã đọc' });
    } catch (error) {
      return next(error);
    }
  },

  markAllAsRead: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await notificationService.markAllAsRead(req.user!.id);
      return res.status(200).json({ success: true, message: 'Đã đọc tất cả thông báo' });
    } catch (error) {
      return next(error);
    }
  }
};