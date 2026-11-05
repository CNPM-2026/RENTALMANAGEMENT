import { NextFunction, Response } from 'express';
import { AuthRequest, resourceOwnerId } from '../middlewares/auth.middleware';
import { maintenanceService } from '../services/maintenance.service';

export const maintenanceController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.status(201).json({ success: true, data: await maintenanceService.create(req.user!.id, req.body) }); }
    catch (error) { return next(error); }
  },
  getMine: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await maintenanceService.getMine(resourceOwnerId(req), req.user!.landlordId ? 'LANDLORD' : req.user!.role) }); }
    catch (error) { return next(error); }
  },
  update: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await maintenanceService.update(resourceOwnerId(req), String(req.params.id), req.body.status) }); }
    catch (error) { return next(error); }
  },
};
