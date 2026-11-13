import { NextFunction, Response } from 'express';
import { AuthRequest, resourceOwnerId } from '../middlewares/auth.middleware';
import { maintenanceService } from '../services/maintenance.service';
import { maintenanceTaskService } from '../services/maintenanceTask.service';

/** Multer trả `req.files` dạng mảng với `upload.array()`; chuẩn hoá tại một chỗ. */
const uploadedFiles = (req: AuthRequest): Express.Multer.File[] =>
  Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];

/**
 * Vai trò HIỆU LỰC khi đọc dữ liệu: nhân viên có `landlordId` đọc trong phạm vi
 * chủ trọ của mình (giống `/my` đang làm), không phải phạm vi cá nhân.
 */
const scopeRole = (req: AuthRequest) => (req.user!.landlordId ? 'LANDLORD' : req.user!.role);

export const maintenanceController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await maintenanceService.create(req.user!.id, req.body, uploadedFiles(req));
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  },
  getMine: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await maintenanceService.getMine(resourceOwnerId(req), scopeRole(req));
      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  },
  getById: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await maintenanceService.getById(
        resourceOwnerId(req),
        scopeRole(req),
        String(req.params.id),
      );
      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  },
  triage: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await maintenanceService.triage(resourceOwnerId(req), String(req.params.id), req.body);
      return res.json({ success: true, message: 'Đã cập nhật trạng thái tiếp nhận sự cố', data });
    } catch (error) {
      return next(error);
    }
  },
  /**
   * 🆕 Chuyển sự cố thành công việc cần thợ. Toàn bộ bất biến (quyền sở hữu,
   * chống đăng trùng, prefill, liên kết 2 chiều) nằm trong service — controller
   * chỉ chuyển tiếp.
   */
  createTaskFromIssue: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await maintenanceTaskService.createFromIssue(
        resourceOwnerId(req),
        String(req.params.id),
        req.body,
        uploadedFiles(req),
      );
      return res.status(201).json({ success: true, message: 'Đã tạo công việc từ sự cố', data });
    } catch (error) {
      return next(error);
    }
  },
  update: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await maintenanceService.update(
        resourceOwnerId(req),
        String(req.params.id),
        req.body.status,
      );
      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  },
};
