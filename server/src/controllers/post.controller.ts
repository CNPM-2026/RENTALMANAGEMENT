import { NextFunction, Response } from 'express';
import { postService } from '../services/post.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const postController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // req.files chứa thông tin các file được upload (từ multer)
      const files = req.files as Express.Multer.File[];
      const result = await postService.createPost(req.user!.id, req.body, files);
      
      return res.status(201).json({
        success: true,
        message: 'Đăng tin thành công, vui lòng chờ Admin duyệt',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getApprovedPosts: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await postService.getApprovedPosts(req.query);
      
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách bài đăng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },
  search: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // req.query đã được Zod validate và ép kiểu ở middleware
      const result = await postService.searchPosts(req.query);
      
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách bài đăng thành công',
        ...result, // Spread data và meta ra
      });
    } catch (error) {
      return next(error);
    }
  },
  getMyPosts: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await postService.getMyPosts(req.user!.id);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  update: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      const result = await postService.updatePost(req.user!.id, String(req.params.id), req.body, files);
      return res.status(200).json({ 
        success: true, 
        message: 'Cập nhật bài đăng thành công (Đang chờ duyệt lại)', 
        data: result 
      });
    } catch (error) {
      return next(error);
    }
  },

  delete: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await postService.deletePost(req.user!.id, req.user!.role, String(req.params.id));
      return res.status(200).json({ success: true, message: 'Xóa bài đăng thành công' });
    } catch (error) {
      return next(error);
    }
  }
};