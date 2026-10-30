import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { PostStatus } from '@prisma/client';

export const adminController = {
  getPendingPosts: async (req: Request, res: Response) => {
    try {
      const result = await adminService.getPendingPosts();
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  updatePostStatus: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body; // APPROVED hoặc REJECTED
      
      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
      }

      const result = await adminService.updatePostStatus(String(id), status as PostStatus);
      return res.status(200).json({ 
        success: true, 
        message: `Đã ${status === 'APPROVED' ? 'duyệt' : 'từ chối'} bài đăng`,
        data: result 
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
};