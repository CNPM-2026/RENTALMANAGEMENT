import { NextFunction, Response } from 'express';
import { appointmentService } from '../services/appointment.service';
import { AuthRequest, resourceOwnerId } from '../middlewares/auth.middleware';

/**
 * `?scope=tenant` do portal khách thuê gửi: luôn thao tác trên lịch hẹn của
 * CHÍNH MÌNH, kể cả khi tài khoản đồng thời là nhân viên của một chủ trọ.
 * Không có scope thì giữ nguyên phạm vi cũ (staff → chủ trọ đã cấp quyền).
 */
const scope = (req: AuthRequest) => {
  if (req.query.scope === 'tenant' && req.user!.role === 'TENANT') {
    return { userId: req.user!.id, role: 'TENANT' };
  }
  return {
    userId: resourceOwnerId(req),
    role: req.user!.landlordId ? 'LANDLORD' : req.user!.role,
  };
};

export const appointmentController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await appointmentService.createAppointment(req.user!.id, req.body);
      return res.status(201).json({
        success: true,
        message: 'Đặt lịch xem phòng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getMyAppointments: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = scope(req);
      const result = await appointmentService.getMyAppointments(userId, role);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  updateStatus: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = scope(req);
      const result = await appointmentService.updateStatus(userId, String(req.params.id), req.body.status);
      return res.status(200).json({
        success: true,
        message: 'Cập nhật trạng thái thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
};