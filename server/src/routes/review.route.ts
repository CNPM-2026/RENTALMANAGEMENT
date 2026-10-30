import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { reviewSchema } from '../validations/resource.validation';

const router = Router();

// Ai cũng có thể xem đánh giá của người khác
router.get('/:targetType/:targetId', reviewController.getByTarget);

// Phải đăng nhập mới được tạo đánh giá
router.post('/', authenticate, validate(reviewSchema), reviewController.create);

export default router;