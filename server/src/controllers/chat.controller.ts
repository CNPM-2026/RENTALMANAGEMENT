import { NextFunction, Response } from 'express';
import { chatService } from '../services/chat.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const chatController = {
  createConversation: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { targetUserId } = req.body;
      const result = await chatService.getOrCreateConversation(req.user!.id, targetUserId);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  getMyConversations: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await chatService.getMyConversations(req.user!.id);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  getMessages: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const result = await chatService.getMessages(req.user!.id, String(req.params.id), page, limit);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  markAsRead: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await chatService.markAsRead(req.user!.id, String(req.params.id));
      return res.status(200).json({ success: true, message: 'Đã đánh dấu đã đọc' });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * Gửi tin nhắn VĂN BẢN qua HTTP.
   *
   * Tính năng gửi ảnh đã bị gỡ (yêu cầu sản phẩm): route không còn nhận tệp và
   * controller không đọc `req.files`, nên không có đường nào để tạo tin nhắn
   * đính kèm mới.
   */
  sendMessage: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await chatService.sendMessage(req.user!.id, String(req.params.id), {
        content: typeof req.body.content === 'string' ? req.body.content : '',
        clientMessageId: typeof req.body.clientMessageId === 'string' ? req.body.clientMessageId : undefined,
      });
      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },
};
