import { Response } from 'express';
import { statisticService } from '../services/statistic.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const statisticController = {
  getAdminStats: async (req: AuthRequest, res: Response) => {
    try {
      const result = await statisticService.getAdminStats();
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  getLandlordStats: async (req: AuthRequest, res: Response) => {
    try {
      const result = await statisticService.getLandlordStats(req.user!.id);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
};