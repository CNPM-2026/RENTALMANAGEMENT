import { NextFunction, Response } from 'express';
import { userService } from '../services/user.service';
import { AuthRequest } from '../middlewares/auth.middleware';

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
  }
};