import { Router } from 'express';
import { propertyController } from '../controllers/property.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { propertySchema } from '../validations/resource.validation';

const router = Router();

// Public endpoint để xem thông tin nhà trọ
router.get('/public/:id', propertyController.getById);

// Áp dụng middleware cho các route bên dưới:
// 1. Phải đăng nhập (authenticate)
// 2. Chỉ có LANDLORD mới được dùng (authorize)
router.use(authenticate, authorize('LANDLORD')); 

router.post('/', validate(propertySchema), propertyController.create);
router.put('/:id', validate(propertySchema.partial()), propertyController.update);
router.get('/my', propertyController.getMyProperties);
router.get('/:id', propertyController.getById);

export default router;
