import { Response } from 'express';
import { matchingService } from '../services/matching.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const matchingController = {
  getQuestions: async (req: AuthRequest, res: Response) => {
    try {
      const result = await matchingService.getQuestions();
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  submitAnswers: async (req: AuthRequest, res: Response) => {
    try {
      const result = await matchingService.submitAnswers(req.user!.id, req.body.answers);
      return res.status(200).json({ success: true, message: result.message });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  updatePreferences: async (req: AuthRequest, res: Response) => {
    try {
      const result = await matchingService.updatePreferences(req.user!.id, req.body);
      return res.status(200).json({ success: true, message: 'Cập nhật tiêu chí thành công', data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  getSuggestedRoommates: async (req: AuthRequest, res: Response) => {
    try {
      const result = await matchingService.getSuggestedRoommates(req.user!.id);
      return res.status(200).json({ 
        success: true, 
        message: 'Lấy danh sách người ở ghép tương thích thành công', 
        data: result 
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
};