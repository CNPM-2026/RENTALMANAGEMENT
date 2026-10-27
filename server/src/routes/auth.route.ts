import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { registerSchema, loginSchema } from '../validations/auth.validation';
import { authLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

// Áp dụng Rate Limit cho toàn bộ route auth
router.use(authLimiter);

// Chèn middleware validate vào giữa Route và Controller
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.getMe);

export default router;