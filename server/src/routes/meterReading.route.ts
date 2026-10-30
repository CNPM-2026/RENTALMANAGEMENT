import { Router } from 'express';
import { meterReadingController } from '../controllers/meterReading.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { meterReadingSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate, authorize('LANDLORD'));
router.post('/', validate(meterReadingSchema), meterReadingController.create);
export default router;