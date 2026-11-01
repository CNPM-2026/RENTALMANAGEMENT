import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { invoiceSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate);

// Chỉ chủ trọ mới được tạo hóa đơn và xác nhận thanh toán
router.post('/generate', authorize('LANDLORD'), validate(invoiceSchema), invoiceController.generate);
router.patch('/:id/pay', authorize('LANDLORD'), invoiceController.pay);

router.get('/my', authorize('LANDLORD', 'TENANT'), invoiceController.getMyInvoices);

export default router;