import { Router } from 'express';
import { postController } from '../controllers/post.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload } from '../config/multer';
import { validate } from '../middlewares/validate.middleware';
import { searchPostSchema } from '../validations/post.validation';

const router = Router();

router.get('/', postController.getApprovedPosts);
router.get('/search', validate(searchPostSchema), postController.search);
router.get('/my-posts', authenticate, postController.getMyPosts);
router.post(
  '/', 
  authenticate, 
  upload.array('images', 10), 
  postController.create
);
router.put(
  '/:id', 
  authenticate, 
  upload.array('images', 10), 
  postController.update
);
router.delete('/:id', authenticate, postController.delete);
export default router;