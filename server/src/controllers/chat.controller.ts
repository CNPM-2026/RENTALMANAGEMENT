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
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const result = await chatService.getMessages(req.user!.id, String(id), page);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }
};