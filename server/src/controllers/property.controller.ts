import { Response } from 'express';
import { propertyService } from '../services/property.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const propertyController = {
  create: async (req: AuthRequest, res: Response) => {
    try {
      // req.user được lấy từ middleware authenticate
      const landlordId = req.user.id; 
      const result = await propertyService.createProperty(landlordId, req.body);
      
      return res.status(201).json({
        success: true,
        message: 'Tạo nhà trọ thành công',
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  getMyProperties: async (req: AuthRequest, res: Response) => {
    try {
      const landlordId = req.user.id;
      const result = await propertyService.getMyProperties(landlordId);
      
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách nhà trọ thành công',
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
};