import { Router } from 'express';
import { statisticController } from '../controllers/statistic.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/admin', authorize('ADMIN'), statisticController.getAdminStats);
router.get('/landlord', authorize('LANDLORD'), statisticController.getLandlordStats);

export default router;