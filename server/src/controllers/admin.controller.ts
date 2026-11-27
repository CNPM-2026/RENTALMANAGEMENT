import { NextFunction, Response } from 'express';
import { adminService } from '../services/admin.service';
import { blacklistService } from '../services/blacklist.service';
import { PostStatus } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';

export const adminController = {
  getPendingPosts: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.getPendingPosts();
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  updatePostStatus: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body; // APPROVED hoặc REJECTED

      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
      }

      const result = await adminService.updatePostStatus(
        String(id),
        status as PostStatus,
        reason ? String(reason) : undefined,
        req.user?.id
      );
      return res.status(200).json({ 
        success: true, 
        message: `Đã ${status === 'APPROVED' ? 'duyệt' : 'từ chối'} bài đăng`,
        data: result 
      });
    } catch (error) {
      return next(error);
    }
  },

  deletePost: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({ success: true, data: await adminService.deletePost(req.user!.id, String(req.params.id)) });
    } catch (error) { return next(error); }
  },

  getUsers: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await adminService.getUsers({ role: req.query.role as string, search: req.query.search as string }) }); }
    catch (error) { return next(error); }
  },

  updateUserStatus: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (typeof req.body.isActive !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Trạng thái isActive phải là giá trị boolean' });
      }
      return res.json({
        success: true,
        data: await adminService.updateUserStatus(req.user!.id, String(req.params.id), req.body.isActive, req.body.banReason),
      });
    } catch (error) { return next(error); }
  },

  getKyc: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        data: await adminService.getKycSubmissions(
          req.query.status as string | undefined,
          req.query.role as string | undefined,
        ),
      });
    } catch (error) { return next(error); }
  },

  getKycById: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        data: await adminService.getKycSubmissionById(String(req.params.id)),
      });
    } catch (error) { return next(error); }
  },

  updateKyc: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({ success: true, data: await adminService.updateKyc(req.user!.id, String(req.params.id), req.body.status, req.body.rejectionReason) });
    } catch (error) { return next(error); }
  },

  getAuditLogs: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const logs = await adminService.getAuditLogs({
        search: req.query.search as string,
        limit: Number(req.query.limit) || 50,
        page: Number(req.query.page) || 1,
        userId: req.query.userId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });
      return res.json({ success: true, data: logs });
    } catch (error) { return next(error); }
  },

  getContentFilterKeywords: async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await adminService.getContentFilterKeywords() }); }
    catch (error) { return next(error); }
  },

  addContentFilterKeyword: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.status(201).json({ success: true, data: await adminService.addContentFilterKeyword(String(req.body.keyword ?? ''), req.user?.id) }); }
    catch (error) { return next(error); }
  },

  removeContentFilterKeyword: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await adminService.removeContentFilterKeyword(String(req.params.id), req.user?.id) }); }
    catch (error) { return next(error); }
  },

  getAmenities: async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await adminService.getAmenities() }); }
    catch (error) { return next(error); }
  },

  createAmenity: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.status(201).json({
        success: true,
        data: await adminService.createAmenity(req.body.name, req.body.iconUrl, req.user?.id),
      });
    } catch (error) { return next(error); }
  },

  deleteAmenity: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({ success: true, data: await adminService.deleteAmenity(String(req.params.id), req.user?.id) });
    } catch (error) { return next(error); }
  },

  getLifestyleQuestions: async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await adminService.getLifestyleQuestions() }); }
    catch (error) { return next(error); }
  },

  createLifestyleQuestion: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.status(201).json({
        success: true,
        message: 'Đã thêm câu hỏi sinh hoạt',
        data: await adminService.createLifestyleQuestion(req.body),
      });
    } catch (error) { return next(error); }
  },

  updateLifestyleQuestion: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã cập nhật câu hỏi sinh hoạt',
        data: await adminService.updateLifestyleQuestion(String(req.params.id), req.body),
      });
    } catch (error) { return next(error); }
  },

  deleteLifestyleQuestion: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã xóa câu hỏi sinh hoạt',
        data: await adminService.deleteLifestyleQuestion(String(req.params.id)),
      });
    } catch (error) { return next(error); }
  },

  getBlacklist: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await blacklistService.getAll({
        search: req.query.search as string,
        type: req.query.type as string,
      });
      return res.json({ success: true, data });
    } catch (error) { return next(error); }
  },

  addToBlacklist: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await blacklistService.create(req.user!.id, req.body);
      return res.status(201).json({ success: true, message: 'Đã thêm vào danh sách đen', data });
    } catch (error) { return next(error); }
  },

  removeFromBlacklist: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await blacklistService.delete(req.user!.id, String(req.params.id));
      return res.json({ success: true, message: 'Đã xóa khỏi danh sách đen', data });
    } catch (error) { return next(error); }
  },
};