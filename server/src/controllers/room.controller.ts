import { Response } from 'express';
import { roomService } from '../services/room.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const roomController = {
  create: async (req: AuthRequest, res: Response) => {
    const result = await roomService.createRoom(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Tạo phòng thành công',
      data: result,
    });
  },

  getByProperty: async (req: AuthRequest, res: Response) => {
    const result = await roomService.getRoomsByProperty(req.user.id, req.params.propertyId);
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách phòng thành công',
      data: result,
    });
  },

  getAmenities: async (req: AuthRequest, res: Response) => {
    const result = await roomService.getAllAmenities();
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách tiện ích thành công',
      data: result,
    });
  }
};