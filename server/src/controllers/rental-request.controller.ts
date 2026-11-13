import { NextFunction, Response } from 'express';
import { AuthRequest, resourceOwnerId } from '../middlewares/auth.middleware';
import { rentalRequestService } from '../services/rental-request.service';

/**
 * Nhân viên được chủ trọ cấp quyền có `landlordId` trong phiên: mọi thao tác
 * quản lý phải chạy trên dữ liệu của CHỦ TRỌ đó và dưới danh nghĩa LANDLORD —
 * `resourceOwnerId` là nguồn duy nhất suy ra id này (không đọc từ client).
 */
const scope = (req: AuthRequest) => ({
  userId: resourceOwnerId(req),
  role: req.user!.landlordId ? 'LANDLORD' : req.user!.role,
});

export const rentalRequestController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.status(201).json({ success: true, data: await rentalRequestService.create(req.user!.id, req.body) }); }
    catch (error) { return next(error); }
  },
  getMine: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = scope(req);
      return res.json({ success: true, data: await rentalRequestService.getMine(userId, role) });
    } catch (error) { return next(error); }
  },
  updateStatus: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = scope(req);
      return res.json({ success: true, data: await rentalRequestService.updateStatus(userId, role, String(req.params.id), req.body.status) });
    } catch (error) { return next(error); }
  },
};
