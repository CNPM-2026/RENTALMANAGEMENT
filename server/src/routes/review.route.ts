import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { reviewSchema } from '../validations/resource.validation';

const router = Router();

// Ai cũng có thể xem đánh giá của người khác
// 🆕 Batch 4: hai route 3 đoạn phải đứng TRƯỚC `/:targetType/:targetId`.
router.get('/task/:taskId/state', authenticate, reviewController.getTaskState);
router.get('/staff/:staffId/summary', reviewController.getStaffSummary);
router.get('/:targetType/:targetId', reviewController.getByTarget);

// Phải đăng nhập mới được tạo đánh giá
router.post('/', authenticate, validate(reviewSchema), reviewController.create);

export default router;