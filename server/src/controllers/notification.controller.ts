import { Response } from 'express';
import { notificationService } from '../services/notification.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const notificationController = {
  getMyNotifications: async (req: AuthRequest, res: Response) => {
    try {
      const result = await notificationService.getMyNotifications(req.user.id);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  markAsRead: async (req: AuthRequest, res: Response) => {
    try {
      await notificationService.markAsRead(req.user.id, String(req.params.id));
      return res.status(200).json({ success: true, message: 'Đã đánh dấu đã đọc' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  markAllAsRead: async (req: AuthRequest, res: Response) => {
    try {
      await notificationService.markAllAsRead(req.user.id);
      return res.status(200).json({ success: true, message: 'Đã đọc tất cả thông báo' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
};