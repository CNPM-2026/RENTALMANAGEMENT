import { Router } from 'express';
import { postController } from '../controllers/post.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload } from '../config/multer';

const router = Router();

// Lấy danh sách bài đăng (Public, ai cũng xem được)
router.get('/', postController.getApprovedPosts);

// Tạo bài đăng (Phải đăng nhập, ai cũng có thể đăng: LANDLORD đăng cho thuê, TENANT đăng tìm phòng)
// upload.array('images', 10): Nhận tối đa 10 file với key là 'images'
router.post(
  '/', 
  authenticate, 
  upload.array('images', 10), 
  postController.create
);

export default router;