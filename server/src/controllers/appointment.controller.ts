import { Response } from 'express';
import { appointmentService } from '../services/appointment.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const appointmentController = {
  create: async (req: AuthRequest, res: Response) => {
    try {
      const result = await appointmentService.createAppointment(req.user!.id, req.body);
      return res.status(201).json({
        success: true,
        message: 'Đặt lịch xem phòng thành công',
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  getMyAppointments: async (req: AuthRequest, res: Response) => {
    try {
      const result = await appointmentService.getMyAppointments(req.user!.id, req.user!.role);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  updateStatus: async (req: AuthRequest, res: Response) => {
    try {
      const result = await appointmentService.updateStatus(req.user!.id, String(req.params.id), req.body.status);
      return res.status(200).json({
        success: true,
        message: 'Cập nhật trạng thái thành công',
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
};