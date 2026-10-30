import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { reportSchema, reportStatusSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate);

// Ai cũng được gửi báo cáo
router.post('/', validate(reportSchema), reportController.create);

// Chỉ Admin mới được xem và xử lý
router.get('/', authorize('ADMIN'), reportController.getAll);
router.patch('/:id/resolve', authorize('ADMIN'), validate(reportStatusSchema), reportController.resolve);

export default router;