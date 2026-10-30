import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

// Ai cũng được gửi báo cáo
router.post('/', reportController.create);

// Chỉ Admin mới được xem và xử lý
router.get('/', authorize('ADMIN'), reportController.getAll);
router.patch('/:id/resolve', authorize('ADMIN'), reportController.resolve);

export default router;