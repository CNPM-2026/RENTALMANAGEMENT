import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { rentalRequestService } from '../services/rental-request.service';

export const rentalRequestController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.status(201).json({ success: true, data: await rentalRequestService.create(req.user!.id, req.body) }); }
    catch (error) { return next(error); }
  },
  getMine: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await rentalRequestService.getMine(req.user!.id, req.user!.role) }); }
    catch (error) { return next(error); }
  },
  updateStatus: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await rentalRequestService.updateStatus(req.user!.id, req.user!.role, String(req.params.id), req.body.status) }); }
    catch (error) { return next(error); }
  },
};
