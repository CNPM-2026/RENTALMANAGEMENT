import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { roommateInvitationController } from '../controllers/roommate-invitation.controller';
import { roommateInvitationCreateSchema, roommateInvitationStatusSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate);
// Trang `/tenant/roommate-invitations` là route dùng chung trong portal khách
// thuê: mọi role được ĐỌC lời mời của chính mình (thường rỗng với role khác).
// Tạo / phản hồi lời mời vẫn chỉ TENANT.
router.get('/my', roommateInvitationController.getMine);
router.post('/', authorize('TENANT'), validate(roommateInvitationCreateSchema), roommateInvitationController.create);
router.patch('/:id/status', authorize('TENANT'), validate(roommateInvitationStatusSchema), roommateInvitationController.updateStatus);
export default router;
