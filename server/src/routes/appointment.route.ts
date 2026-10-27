import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate); // Phải đăng nhập

router.post('/', appointmentController.create);
router.get('/my', appointmentController.getMyAppointments);
router.patch('/:id/status', appointmentController.updateStatus);

export default router;