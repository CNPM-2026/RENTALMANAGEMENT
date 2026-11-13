import { NextFunction, Response } from 'express';
import { statisticService } from '../services/statistic.service';
import { AuthRequest, resourceOwnerId } from '../middlewares/auth.middleware';

export const statisticController = {
  getAdminStats: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await statisticService.getAdminStats();
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  getLandlordStats: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await statisticService.getLandlordStats(resourceOwnerId(req));
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }
};