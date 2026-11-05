import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { roommateInvitationService } from '../services/roommate-invitation.service';

export const roommateInvitationController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.status(201).json({ success: true, data: await roommateInvitationService.create(req.user!.id, req.body) }); }
    catch (error) { return next(error); }
  },
  getMine: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const type = req.query.type === 'sent' ? 'sent' : 'received';
      return res.json({ success: true, data: await roommateInvitationService.getMine(req.user!.id, type) });
    } catch (error) { return next(error); }
  },
  updateStatus: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await roommateInvitationService.updateStatus(req.user!.id, String(req.params.id), req.body.status) }); }
    catch (error) { return next(error); }
  },
};
