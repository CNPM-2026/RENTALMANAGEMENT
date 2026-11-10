import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { postController } from '../controllers/post.controller';
import { authenticate, authenticateOptional } from '../middlewares/auth.middleware';
import { upload, validateUploadedImages } from '../config/multer';
import { validate } from '../middlewares/validate.middleware';
import { searchPostSchema } from '../validations/post.validation';
import { postWriteSchema, postUpdateSchema } from '../validations/resource.validation';

const router = Router();

const postWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 write requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', postController.getApprovedPosts);
router.get('/search', validate(searchPostSchema, 'query'), postController.search);
router.get('/my-posts', authenticate, postController.getMyPosts);
router.get('/:id', authenticateOptional, postController.getById);
router.post(
  '/',
  postWriteLimiter,
  authenticate,
  upload.array('images', 10),
  validateUploadedImages,
  validate(postWriteSchema),
  postController.create
);
router.put(
  '/:id',
  postWriteLimiter,
  authenticate,
  upload.array('images', 10),
  validateUploadedImages,
  validate(postUpdateSchema),
  postController.update
);
router.delete('/:id', authenticate, postController.delete);
export default router;