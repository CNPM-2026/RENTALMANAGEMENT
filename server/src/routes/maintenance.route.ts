import { Router } from 'express';
import { authenticate, authorize, authorizeStaff, authorizeStaffOr } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { maintenanceController } from '../controllers/maintenance.controller';
import { maintenanceCreateSchema, maintenanceStatusSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate);
router.post('/', authorize('TENANT'), validate(maintenanceCreateSchema), maintenanceController.create);
router.get('/my', authorizeStaffOr('MAINTENANCE', 'TENANT', 'LANDLORD'), maintenanceController.getMine);
router.patch('/:id/status', authorizeStaff('MAINTENANCE'), validate(maintenanceStatusSchema), maintenanceController.update);
export default router;
