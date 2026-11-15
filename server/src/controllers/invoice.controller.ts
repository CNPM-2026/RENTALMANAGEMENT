import { NextFunction, Response } from 'express';
import { invoiceService } from '../services/invoice.service';
import { AuthRequest, resourceOwnerId } from '../middlewares/auth.middleware';

export const invoiceController = {
  generate: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await invoiceService.generateInvoice(resourceOwnerId(req), req.body);
      return res.status(201).json({
        success: true,
        message: 'Xuất hóa đơn thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  preview: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as {
        roomId: string;
        month: number;
        year: number;
        otherFee?: number;
      };
      const result = await invoiceService.previewInvoice(resourceOwnerId(req), {
        roomId: query.roomId,
        month: Number(query.month),
        year: Number(query.year),
        otherFee: query.otherFee,
      });
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  getMyInvoices: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // `?scope=tenant` dành cho portal khách thuê: đọc hoá đơn của CHÍNH MÌNH
      // dù tài khoản đồng thời là nhân viên của chủ trọ.
      const tenantScope = req.query.scope === 'tenant' && req.user!.role === 'TENANT';
      const result = await invoiceService.getMyInvoices(
        tenantScope ? req.user!.id : resourceOwnerId(req),
        tenantScope ? 'TENANT' : req.user!.landlordId ? 'LANDLORD' : req.user!.role,
      );
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách hóa đơn thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  pay: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await invoiceService.payInvoice(resourceOwnerId(req), String(req.params.id));
      return res.status(200).json({
        success: true,
        message: 'Đã xác nhận thanh toán hóa đơn',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
};