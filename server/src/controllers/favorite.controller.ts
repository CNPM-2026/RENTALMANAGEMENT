import { Response } from 'express';
import { favoriteService } from '../services/favorite.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const favoriteController = {
  toggle: async (req: AuthRequest, res: Response) => {
    try {
      const result = await favoriteService.toggleFavorite(req.user!.id, String(req.params.postId));
      return res.status(200).json({ success: true, ...result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  getMyFavorites: async (req: AuthRequest, res: Response) => {
    try {
      const result = await favoriteService.getMyFavorites(req.user!.id);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
};