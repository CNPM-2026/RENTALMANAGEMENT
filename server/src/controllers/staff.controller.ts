import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { staffService } from '../services/staff.service';

export const staffController = {
  /** Quyền của chính mình (mọi role đã đăng nhập) — `null` nếu không phải nhân viên. */
  getMyMembership: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({ success: true, data: await staffService.getMyMembership(req.user!.id) });
    } catch (error) {
      return next(error);
    }
  },
  list: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await staffService.list(req.user!.id) }); }
    catch (error) { return next(error); }
  },
  invite: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.status(201).json({ success: true, data: await staffService.invite(req.user!.id, req.body.email, req.body.permissions) });
    } catch (error) { return next(error); }
  },
  update: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await staffService.update(req.user!.id, String(req.params.id), req.body) }); }
    catch (error) { return next(error); }
  },
  remove: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { await staffService.remove(req.user!.id, String(req.params.id)); return res.status(204).send(); }
    catch (error) { return next(error); }
  },
};
