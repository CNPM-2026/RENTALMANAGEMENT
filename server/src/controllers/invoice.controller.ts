import { Response } from 'express';
import { invoiceService } from '../services/invoice.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const invoiceController = {
  generate: async (req: AuthRequest, res: Response) => {
    try {
      const result = await invoiceService.generateInvoice(req.user.id, req.body);
      return res.status(201).json({
        success: true,
        message: 'Xuất hóa đơn thành công',
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  getMyInvoices: async (req: AuthRequest, res: Response) => {
    try {
      const result = await invoiceService.getMyInvoices(req.user.id, req.user.role);
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách hóa đơn thành công',
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  pay: async (req: AuthRequest, res: Response) => {
    try {
      const result = await invoiceService.payInvoice(req.user.id, String(req.params.id));
      return res.status(200).json({
        success: true,
        message: 'Đã xác nhận thanh toán hóa đơn',
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
};