import { Router } from 'express';
import { postController } from '../controllers/post.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload } from '../config/multer';
import { validate } from '../middlewares/validate.middleware';
import { searchPostSchema } from '../validations/post.validation';
import { postWriteSchema } from '../validations/resource.validation';

const router = Router();

router.get('/', postController.getApprovedPosts);
router.get('/search', validate(searchPostSchema, 'query'), postController.search);
router.get('/my-posts', authenticate, postController.getMyPosts);
router.post(
  '/', 
  authenticate, 
  upload.array('images', 10), 
  validate(postWriteSchema),
  postController.create
);
router.put(
  '/:id', 
  authenticate, 
  upload.array('images', 10), 
  validate(postWriteSchema.partial()),
  postController.update
);
router.delete('/:id', authenticate, postController.delete);
export default router;