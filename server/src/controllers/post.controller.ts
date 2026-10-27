import { Response } from 'express';
import { postService } from '../services/post.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const postController = {
  create: async (req: AuthRequest, res: Response) => {
    try {
      // req.files chứa thông tin các file được upload (từ multer)
      const files = req.files as Express.Multer.File[];
      const result = await postService.createPost(req.user.id, req.body, files);
      
      return res.status(201).json({
        success: true,
        message: 'Đăng tin thành công, vui lòng chờ Admin duyệt',
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  },

  getApprovedPosts: async (req: AuthRequest, res: Response) => {
    try {
      const result = await postService.getApprovedPosts(req.query);
      
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách bài đăng thành công',
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
};