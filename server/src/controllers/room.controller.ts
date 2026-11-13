import { NextFunction, Response } from 'express';
import { roomService } from '../services/room.service';
import { AuthRequest, resourceOwnerId } from '../middlewares/auth.middleware';

export const roomController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await roomService.createRoom(resourceOwnerId(req), req.body);
      return res.status(201).json({
        success: true,
        message: 'Tạo phòng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  update: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await roomService.updateRoom(
        resourceOwnerId(req),
        String(req.params.id),
        req.body,
      );
      return res.status(200).json({
        success: true,
        message: 'Cập nhật phòng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getByProperty: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await roomService.getRoomsByProperty(resourceOwnerId(req), String(req.params.propertyId));
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
  },

  delete: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await roomService.deleteRoom(resourceOwnerId(req), String(req.params.id));
      return res.status(200).json({ success: true, message: 'Xóa phòng thành công' });
    } catch (error) {
      return next(error);
    }
  }
};