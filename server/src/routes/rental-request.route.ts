import { Router } from 'express';
import { authenticate, authorize, authorizeStaffOr } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { rentalRequestController } from '../controllers/rental-request.controller';
import { rentalRequestCreateSchema, rentalRequestStatusSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate);
router.post('/', authorize('TENANT'), validate(rentalRequestCreateSchema), rentalRequestController.create);
// Nhân viên được cấp quyền APPOINTMENTS xử lý yêu cầu thuê trong phạm vi chủ trọ
// đã cấp quyền (controller dùng `resourceOwnerId`, không tin id từ client).
router.get('/my', authorizeStaffOr('APPOINTMENTS', 'TENANT', 'LANDLORD'), rentalRequestController.getMine);
router.patch('/:id/status', authorizeStaffOr('APPOINTMENTS', 'TENANT', 'LANDLORD'), validate(rentalRequestStatusSchema), rentalRequestController.updateStatus);
export default router;
