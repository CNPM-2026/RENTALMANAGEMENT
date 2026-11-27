import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { roommateInvitationController } from '../controllers/roommate-invitation.controller';
import { roommateInvitationCreateSchema, roommateInvitationStatusSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate);
// Mọi role (TENANT, ADMIN, STAFF, LANDLORD) đều có thể sử dụng tính năng ở ghép.
// Ngoại lệ: LANDLORD không được phép đứng làm chủ hợp đồng đại diện (kiểm tra ở service).
router.get('/my', roommateInvitationController.getMine);
router.post('/', authorize('TENANT', 'ADMIN', 'STAFF', 'LANDLORD'), validate(roommateInvitationCreateSchema), roommateInvitationController.create);
router.patch('/:id/status', authorize('TENANT', 'ADMIN', 'STAFF', 'LANDLORD'), validate(roommateInvitationStatusSchema), roommateInvitationController.updateStatus);
export default router;
