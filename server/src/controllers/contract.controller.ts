import { NextFunction, Response } from 'express';
import { contractService } from '../services/contract.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ContractStatus } from '@prisma/client';

export const contractController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await contractService.createContract(req.user!.id, req.body);
      return res.status(201).json({
        success: true,
        message: 'Tạo hợp đồng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getMyContracts: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await contractService.getMyContracts(req.user!.id, req.user!.role);
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách hợp đồng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  updateStatus: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      const result = await contractService.updateStatus(req.user!.id, String(req.params.id), status as ContractStatus);
      return res.status(200).json({
        success: true,
        message: 'Cập nhật trạng thái hợp đồng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
};