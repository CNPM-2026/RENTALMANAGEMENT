import { NextFunction, Response } from 'express';
import { reportService, DisputeStatus } from '../services/report.service';
import { AuthRequest } from '../middlewares/auth.middleware';

const uploadedFiles = (req: AuthRequest): Express.Multer.File[] =>
  Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];

export const reportController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await reportService.createReport(
        req.user!.id,
        req.user!.role,
        req.body as { targetType: string; targetId: string; category?: never; reason: string; taskId?: string },
        uploadedFiles(req),
      );
      return res.status(201).json({ success: true, message: 'Đã gửi báo cáo, Admin sẽ sớm xử lý!', data: result });
    } catch (error) {
      return next(error);
    }
  },

  getAll: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await reportService.getAllReports(
        { id: req.user!.id, role: req.user!.role },
        {
          status: typeof req.query.status === 'string' ? req.query.status : undefined,
          category: typeof req.query.category === 'string' ? req.query.category : undefined,
        },
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  getMy: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await reportService.getMyReports(req.user!.id, req.user!.role);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  resolve: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await reportService.resolveReport(req.user!.id, String(req.params.id), {
        status: req.body.status as DisputeStatus,
        resolution: req.body.resolution ?? null,
      });
      return res.status(200).json({ success: true, message: 'Đã xử lý báo cáo', data: result });
    } catch (error) {
      return next(error);
    }
  },
};
