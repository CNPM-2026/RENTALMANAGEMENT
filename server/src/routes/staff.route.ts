import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { staffController } from '../controllers/staff.controller';
import { staffInviteSchema, staffUpdateSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate, authorize('LANDLORD'));
router.get('/', staffController.list);
router.post('/', validate(staffInviteSchema), staffController.invite);
router.patch('/:id', validate(staffUpdateSchema), staffController.update);
router.delete('/:id', staffController.remove);
export default router;
