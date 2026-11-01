import { NextFunction, Response } from 'express';
import { propertyService } from '../services/property.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const propertyController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // req.user được lấy từ middleware authenticate
      const landlordId = req.user!.id; 
      const result = await propertyService.createProperty(landlordId, req.body);
      
      return res.status(201).json({
        success: true,
        message: 'Tạo nhà trọ thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getMyProperties: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const landlordId = req.user!.id;
      const result = await propertyService.getMyProperties(landlordId);
      
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách nhà trọ thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
};