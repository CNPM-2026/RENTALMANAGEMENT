import { Response } from 'express';
import { postService } from '../services/post.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const postController = {
  create: async (req: AuthRequest, res: Response) => {
    // req.files chứa thông tin các file được upload (từ multer)
    const files = req.files as Express.Multer.File[];
    const result = await postService.createPost(req.user.id, req.body, files);
    
    res.status(201).json({
      success: true,
      message: 'Đăng tin thành công, vui lòng chờ Admin duyệt',
      data: result,
    });
  },

  getApprovedPosts: async (req: AuthRequest, res: Response) => {
    const result = await postService.getApprovedPosts(req.query);
    
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách bài đăng thành công',
      data: result,
    });
  }
};