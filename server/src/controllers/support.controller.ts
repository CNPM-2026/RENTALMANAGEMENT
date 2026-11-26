import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { supportService } from '../services/support.service';

export const supportController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.status(201).json({ success: true, data: await supportService.create(req.user!.id, req.body) }); }
    catch (error) { return next(error); }
  },
  createPublic: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.status(201).json({
        success: true,
        message: 'Gửi yêu cầu hỗ trợ thành công. Ban quản trị sẽ phản hồi sớm nhất có thể.',
        data: await supportService.createPublic(req.body),
      });
    } catch (error) { return next(error); }
  },
  getMine: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await supportService.getMine(req.user!.id) }); }
    catch (error) { return next(error); }
  },
  getById: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await supportService.getById(req.user!.id, String(req.params.id)) }); }
    catch (error) { return next(error); }
  },
  getAll: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await supportService.getAll(req.query.status as string | undefined) }); }
    catch (error) { return next(error); }
  },
  update: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await supportService.update(String(req.params.id), req.body) }); }
    catch (error) { return next(error); }
  },
};
