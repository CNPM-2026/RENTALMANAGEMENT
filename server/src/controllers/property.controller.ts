import { Response } from 'express';
import { propertyService } from '../services/property.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const propertyController = {
  create: async (req: AuthRequest, res: Response) => {
    try {
      const landlordId = req.user!.id; 
      const result = await propertyService.createProperty(landlordId, req.body);
      
      return res.status(201).json({
        success: true,
        message: 'Tạo nhà trọ thành công',
        data: result,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  update: async (req: AuthRequest, res: Response) => {
    try {
      const landlordId = req.user!.id;
      const result = await propertyService.updateProperty(landlordId, String(req.params.id), req.body);

      return res.status(200).json({
        success: true,
        message: 'Cập nhật nhà trọ thành công',
        data: result,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  getById: async (req: AuthRequest, res: Response) => {
    try {
      const result = await propertyService.getPropertyById(String(req.params.id));
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  getMyProperties: async (req: AuthRequest, res: Response) => {
    try {
      const landlordId = req.user!.id;
      const result = await propertyService.getMyProperties(landlordId);
      
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách nhà trọ thành công',
        data: result,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
};
