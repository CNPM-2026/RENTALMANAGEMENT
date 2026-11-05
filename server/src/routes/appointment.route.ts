import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller';
import { authenticate, authorize, authorizeStaff, authorizeStaffOr } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createAppointmentSchema, updateAppointmentStatusSchema } from '../validations/appointment.validation';

const router = Router();

router.use(authenticate); 

router.post('/', authorize('TENANT'), validate(createAppointmentSchema), appointmentController.create);
router.get('/my', appointmentController.getMyAppointments);
router.patch('/:id/status', authorizeStaffOr('APPOINTMENTS', 'TENANT', 'LANDLORD'), validate(updateAppointmentStatusSchema), appointmentController.updateStatus);

export default router;