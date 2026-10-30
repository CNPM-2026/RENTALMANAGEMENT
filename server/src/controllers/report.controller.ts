import { Response } from 'express';
import { reportService } from '../services/report.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const reportController = {
  create: async (req: AuthRequest, res: Response) => {
    try {
      const result = await reportService.createReport(req.user.id, req.body);
      return res.status(201).json({ success: true, message: 'Đã gửi báo cáo, Admin sẽ sớm xử lý!', data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  getAll: async (req: AuthRequest, res: Response) => {
    try {
      const result = await reportService.getAllReports(req.query.status as string);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  resolve: async (req: AuthRequest, res: Response) => {
    try {
      const result = await reportService.resolveReport(req.params.id, req.body.status);
      return res.status(200).json({ success: true, message: 'Đã xử lý báo cáo', data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
};