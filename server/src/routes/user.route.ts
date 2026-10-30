import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload } from '../config/multer';
import { validate } from '../middlewares/validate.middleware';
import { updateProfileSchema } from '../validations/user.validation';

const router = Router();
router.use(authenticate);

// upload.single('avatar'): Chỉ nhận 1 file với key là 'avatar'
router.put(
  '/profile', 
  upload.single('avatar'), 
  validate(updateProfileSchema), 
  userController.updateProfile
);

export default router;  