import { Router } from 'express';
import { favoriteController } from '../controllers/favorite.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);
router.get('/', favoriteController.getMyFavorites);
router.post('/:postId', favoriteController.toggle);

export default router;