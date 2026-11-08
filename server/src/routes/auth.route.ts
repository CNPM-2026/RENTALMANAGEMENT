import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { registerSchema, loginSchema, refreshTokenSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema } from '../validations/auth.validation';
import { authLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

// Áp dụng Rate Limit cho toàn bộ route auth
router.use(authLimiter);

// Chèn middleware validate vào giữa Route và Controller
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/logout', validate(refreshTokenSchema), authController.logout);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-verification', validate(forgotPasswordSchema), authController.resendVerification);
router.get('/me', authenticate, authController.getMe);

export default router;