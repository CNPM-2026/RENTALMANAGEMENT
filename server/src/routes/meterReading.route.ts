import { Router } from 'express';
import { meterReadingController } from '../controllers/meterReading.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate, authorize('LANDLORD'));
router.post('/', meterReadingController.create);
export default router;