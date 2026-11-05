import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { rentalRequestController } from '../controllers/rental-request.controller';
import { rentalRequestCreateSchema, rentalRequestStatusSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate);
router.post('/', authorize('TENANT'), validate(rentalRequestCreateSchema), rentalRequestController.create);
router.get('/my', authorize('TENANT', 'LANDLORD'), rentalRequestController.getMine);
router.patch('/:id/status', authorize('TENANT', 'LANDLORD'), validate(rentalRequestStatusSchema), rentalRequestController.updateStatus);
export default router;
