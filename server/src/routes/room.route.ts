import { Router } from 'express';
import { roomController } from '../controllers/room.controller';
import { authenticate, authorizeStaff } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { roomSchema } from '../validations/resource.validation';

const router = Router();

// API lấy tiện ích có thể public, nhưng để trong này cũng được
router.get('/amenities', roomController.getAmenities);

// Các API dưới đây yêu cầu quyền LANDLORD
router.use(authenticate, authorizeStaff('PROPERTIES_ROOMS'));

router.post('/', validate(roomSchema), roomController.create);
router.get('/property/:propertyId', roomController.getByProperty);

export default router;