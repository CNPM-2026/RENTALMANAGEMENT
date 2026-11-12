import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { upload, validateUploadedImages } from '../config/multer';
import { validate } from '../middlewares/validate.middleware';
import { updateProfileSchema } from '../validations/user.validation';
import { kycSubmissionSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate, authorize('TENANT', 'LANDLORD', 'STAFF', 'ADMIN'));

// upload.single('avatar'): Chỉ nhận 1 file với key là 'avatar'
router.put(
  '/profile', 
  upload.single('avatar'), 
  validate(updateProfileSchema), 
  userController.updateProfile
);
router.get('/kyc', userController.getMyKyc);
router.post(
  '/kyc',
  upload.fields([{ name: 'frontId', maxCount: 1 }, { name: 'backId', maxCount: 1 }]),
  validateUploadedImages,
  validate(kycSubmissionSchema),
  userController.submitKyc
);

export default router;  