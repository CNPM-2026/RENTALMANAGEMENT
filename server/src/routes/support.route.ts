import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { supportController } from '../controllers/support.controller';
import { supportCreateSchema, supportUpdateSchema } from '../validations/resource.validation';

const router = Router();

// Route công khai cho khách (Guest) và tài khoản bị khóa gửi yêu cầu hỗ trợ / kháng cáo
router.post('/public', supportController.createPublic);

router.use(authenticate);
router.post('/', validate(supportCreateSchema), supportController.create);
router.get('/my', supportController.getMine);
router.get('/admin', authorize('ADMIN'), supportController.getAll);
router.get('/:id', supportController.getById);
router.patch('/:id', authorize('ADMIN'), validate(supportUpdateSchema), supportController.update);
export default router;
