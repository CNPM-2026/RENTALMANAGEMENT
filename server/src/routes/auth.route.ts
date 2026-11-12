import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { registerSchema, loginSchema, refreshTokenSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, setPasswordSchema } from '../validations/auth.validation';
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
// H-05/Batch 2B1: đặt mật khẩu bằng grant phát ra sau khi xác minh email.
// Tuyệt đối KHÔNG dùng `authenticate` ở đây: grant không phải access token.
router.post('/password/set', validate(setPasswordSchema), authController.setPassword);
router.post('/resend-verification', validate(forgotPasswordSchema), authController.resendVerification);
router.get('/google', authController.googleRedirect);
router.get('/google/callback', authController.googleCallback);
router.get('/me', authenticate, authController.getMe);

export default router;