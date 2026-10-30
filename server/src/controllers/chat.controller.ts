import { Response } from 'express';
import { chatService } from '../services/chat.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const chatController = {
  createConversation: async (req: AuthRequest, res: Response) => {
    try {
      const { targetUserId } = req.body;
      const result = await chatService.getOrCreateConversation(req.user!.id, targetUserId);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  getMyConversations: async (req: AuthRequest, res: Response) => {
    try {
      const result = await chatService.getMyConversations(req.user!.id);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  getMessages: async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const result = await chatService.getMessages(req.user!.id, String(id), page);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
};