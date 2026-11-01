import { NextFunction, Response } from 'express';
import { favoriteService } from '../services/favorite.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const favoriteController = {
  toggle: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await favoriteService.toggleFavorite(req.user!.id, String(req.params.postId));
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return next(error);
    }
  },

  getMyFavorites: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await favoriteService.getMyFavorites(req.user!.id);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }
};