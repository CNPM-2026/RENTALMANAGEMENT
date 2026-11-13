import { NextFunction, Request, Response } from 'express';
import { reviewService } from '../services/review.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const reviewController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await reviewService.createReview(req.user!.id, req.body);
      return res.status(201).json({
        success: true,
        message: 'Cảm ơn bạn đã gửi đánh giá',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getByTarget: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { targetType, targetId } = req.params;
      const result = await reviewService.getReviewsByTarget(String(targetType).toUpperCase(), String(targetId));
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  /** 🆕 Batch 4 — trạng thái đánh giá của một công việc với người xem hiện tại. */
  getTaskState: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await reviewService.getTaskReviewState(req.user!.id, String(req.params.taskId));
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  /** 🆕 Batch 4 — điểm đánh giá tổng hợp của một thợ (tính từ review TASK). */
  getStaffSummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await reviewService.getStaffRatingSummary(String(req.params.staffId));
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },
};