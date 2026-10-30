import { NextFunction, Response } from 'express';
import { matchingService } from '../services/matching.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const matchingController = {
  getQuestions: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await matchingService.getQuestions();
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  submitAnswers: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await matchingService.submitAnswers(req.user!.id, req.body.answers);
      return res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      return next(error);
    }
  },

  updatePreferences: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await matchingService.updatePreferences(req.user!.id, req.body);
      return res.status(200).json({ success: true, message: 'Cập nhật tiêu chí thành công', data: result });
    } catch (error) {
      return next(error);
    }
  },

  getSuggestedRoommates: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await matchingService.getSuggestedRoommates(req.user!.id);
      return res.status(200).json({ 
        success: true, 
        message: 'Lấy danh sách người ở ghép tương thích thành công', 
        data: result 
      });
    } catch (error) {
      return next(error);
    }
  }
};