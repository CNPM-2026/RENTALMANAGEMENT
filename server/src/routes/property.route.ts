import { Router } from 'express';
import { propertyController } from '../controllers/property.controller';
import { authenticate, authorizeStaff } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { propertySchema } from '../validations/resource.validation';

const router = Router();

// Áp dụng middleware cho TẤT CẢ các route bên dưới:
// 1. Phải đăng nhập (authenticate)
// 2. Chỉ có LANDLORD mới được dùng (authorize)
router.use(authenticate, authorizeStaff('PROPERTIES_ROOMS'));

router.post('/', validate(propertySchema), propertyController.create);
router.get('/my', propertyController.getMyProperties);

export default router;