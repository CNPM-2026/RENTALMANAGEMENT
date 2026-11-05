import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { roommateInvitationController } from '../controllers/roommate-invitation.controller';
import { roommateInvitationCreateSchema, roommateInvitationStatusSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate, authorize('TENANT'));
router.post('/', validate(roommateInvitationCreateSchema), roommateInvitationController.create);
router.get('/my', roommateInvitationController.getMine);
router.patch('/:id/status', validate(roommateInvitationStatusSchema), roommateInvitationController.updateStatus);
export default router;
