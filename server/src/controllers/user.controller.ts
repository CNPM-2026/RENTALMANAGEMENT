import { NextFunction, Response } from 'express';
import { userService } from '../services/user.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { storageService } from '../services/storage.service';

export const userController = {
  updateProfile: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // req.file chứa thông tin ảnh (nếu có)
      const file = req.file; 
      const result = await userService.updateProfile(req.user!.id, req.body, file);
      
      return res.status(200).json({
        success: true,
        message: 'Cập nhật hồ sơ thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  submitKyc: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const frontId = files?.frontId?.[0];
      const backId = files?.backId?.[0];
      if (!frontId || !backId) {
        return res.status(400).json({ success: false, message: 'Vui lòng tải lên đủ ảnh CCCD mặt trước và mặt sau' });
      }
      const [frontIdUrl, backIdUrl] = await Promise.all([
        storageService.uploadImage(frontId, 'rental-management/kyc'),
        storageService.uploadImage(backId, 'rental-management/kyc'),
      ]);
      return res.status(200).json({
        success: true,
        data: await userService.submitKyc(req.user!.id, { ...req.body, frontIdUrl, backIdUrl }),
      });
    } catch (error) { return next(error); }
  },

  getMyKyc: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({ success: true, data: await userService.getMyKyc(req.user!.id) });
    } catch (error) { return next(error); }
  }
};