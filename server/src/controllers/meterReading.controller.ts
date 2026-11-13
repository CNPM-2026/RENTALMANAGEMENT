import { NextFunction, Response } from 'express';
import { meterReadingService } from '../services/meterReading.service';
import { AuthRequest, resourceOwnerId } from '../middlewares/auth.middleware';

export const meterReadingController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await meterReadingService.createReading(resourceOwnerId(req), req.body);
      return res.status(201).json({
        success: true,
        message: 'Ghi nhận chỉ số thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getLatest: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const roomId = String(req.query.roomId ?? '');
      const result = await meterReadingService.getLatest(resourceOwnerId(req), roomId);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },
};