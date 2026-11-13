import { NextFunction, Response } from 'express';
import { occupancyService } from '../services/occupancy.service';
import { AuthRequest, resourceOwnerId } from '../middlewares/auth.middleware';

/**
 * Controller mỏng: mọi kiểm tra quyền/ownership nằm ở service để không thể bỏ
 * qua bằng một route mới. `req.user.id` là danh tính đã xác thực — KHÔNG dùng
 * id từ body/query cho hành động ghi.
 */
export const occupancyController = {
  declare: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await occupancyService.declare(req.user!.id, {
        roomId: req.body.roomId,
        occupants: req.body.occupants,
      });
      return res.status(201).json({
        success: true,
        message: 'Đã gửi khai báo số người ở — chờ chủ trọ xác minh',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  listMine: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await occupancyService.listMine(req.user!.id);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  listPending: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await occupancyService.listPending(resourceOwnerId(req));
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  getRoomOccupancy: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await occupancyService.getRoomOccupancy(
        { userId: req.user!.id, role: req.user!.role, landlordId: req.user!.landlordId ?? null },
        String(req.params.roomId),
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  verify: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await occupancyService.verify(resourceOwnerId(req), String(req.params.id));
      return res.status(200).json({
        success: true,
        message: 'Đã xác minh số người ở',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  reject: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await occupancyService.reject(
        resourceOwnerId(req),
        String(req.params.id),
        req.body.reason,
      );
      return res.status(200).json({
        success: true,
        message: 'Đã từ chối khai báo số người ở',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },
};
