import { Router } from 'express';
import { postController } from '../controllers/post.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload } from '../config/multer';
import { validate } from '../middlewares/validate.middleware';
import { searchPostSchema } from '../validations/post.validation';

const router = Router();

// Đổi từ GET '/' cũ sang GET '/search' và áp dụng validate query
router.get('/', postController.getApprovedPosts);
router.get('/search', validate(searchPostSchema), postController.search);
router.post(
  '/', 
  authenticate, 
  upload.array('images', 10), 
  postController.create
);

export default router;