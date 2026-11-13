import { Router } from 'express';
import { statisticController } from '../controllers/statistic.controller';
import { authenticate, authorize, authorizeStaffAny } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/admin', authorize('ADMIN'), statisticController.getAdminStats);
// Mọi nhân viên đang có membership hiệu lực đều xem được tổng quan của chủ trọ
// đã cấp quyền (con số không chứa dữ liệu ngoài phạm vi chủ trọ đó).
router.get('/landlord', authorizeStaffAny(), statisticController.getLandlordStats);

export default router;