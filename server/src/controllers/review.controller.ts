import { Request, Response } from 'express';
import { reviewService } from '../services/review.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const reviewController = {
  create: async (req: AuthRequest, res: Response) => {
    const result = await reviewService.createReview(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Cảm ơn bạn đã gửi đánh giá',
      data: result,
    });
  },

  getByTarget: async (req: Request, res: Response) => {
    const { targetType, targetId } = req.params;
    const result = await reviewService.getReviewsByTarget(String(targetType).toUpperCase(), String(targetId));
    res.status(200).json({
      success: true,
      data: result,
    });
  }
};