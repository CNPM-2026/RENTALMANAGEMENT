import { NextFunction, Response } from 'express';
import { meterReadingService } from '../services/meterReading.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const meterReadingController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await meterReadingService.createReading(req.user!.id, req.body);
      return res.status(201).json({
        success: true,
        message: 'Ghi nhận chỉ số thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
};