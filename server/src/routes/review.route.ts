import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Ai cũng có thể xem đánh giá của người khác
router.get('/:targetType/:targetId', reviewController.getByTarget);

// Phải đăng nhập mới được tạo đánh giá
router.post('/', authenticate, reviewController.create);

export default router;