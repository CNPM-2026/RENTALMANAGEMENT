import { NextFunction, Response } from 'express';
import { adminService } from '../services/admin.service';
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
      const { status } = req.body; // APPROVED hoặc REJECTED
      
      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
      }

      const result = await adminService.updatePostStatus(String(id), status as PostStatus);
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
      return res.json({ success: true, data: await adminService.updateUserStatus(req.user!.id, String(req.params.id), req.body.isActive) });
    } catch (error) { return next(error); }
  },

  getKyc: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await adminService.getKycSubmissions(req.query.status as string) }); }
    catch (error) { return next(error); }
  },

  updateKyc: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({ success: true, data: await adminService.updateKyc(req.user!.id, String(req.params.id), req.body.status, req.body.rejectionReason) });
    } catch (error) { return next(error); }
  },

  getAuditLogs: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await adminService.getAuditLogs({ search: req.query.search as string, limit: Number(req.query.limit) || 100 }) }); }
    catch (error) { return next(error); }
  },

  getContentFilterKeywords: async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await adminService.getContentFilterKeywords() }); }
    catch (error) { return next(error); }
  },

  addContentFilterKeyword: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.status(201).json({ success: true, data: await adminService.addContentFilterKeyword(String(req.body.keyword ?? '')) }); }
    catch (error) { return next(error); }
  },

  removeContentFilterKeyword: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await adminService.removeContentFilterKeyword(String(req.params.id)) }); }
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
        data: await adminService.createAmenity(req.body.name, req.body.iconUrl),
      });
    } catch (error) { return next(error); }
  },

  deleteAmenity: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({ success: true, data: await adminService.deleteAmenity(String(req.params.id)) });
    } catch (error) { return next(error); }
  },
};