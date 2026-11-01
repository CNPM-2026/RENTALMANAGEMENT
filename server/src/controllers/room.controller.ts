import { NextFunction, Response } from 'express';
import { roomService } from '../services/room.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const roomController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await roomService.createRoom(req.user!.id, req.body);
      return res.status(201).json({
        success: true,
        message: 'Tạo phòng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getByProperty: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await roomService.getRoomsByProperty(req.user!.id, String(req.params.propertyId));
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách phòng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getAmenities: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await roomService.getAllAmenities();
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách tiện ích thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
};