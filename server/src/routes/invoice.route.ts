import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller';
import { authenticate, authorize, authorizeStaff, authorizeStaffOr } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { invoiceSchema, invoicePreviewSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate);

// Chỉ chủ trọ mới được tạo hóa đơn và xác nhận thanh toán
router.get('/preview', authorizeStaff('INVOICES'), validate(invoicePreviewSchema, 'query'), invoiceController.preview);
router.post('/generate', authorizeStaff('INVOICES'), validate(invoiceSchema), invoiceController.generate);
router.patch('/:id/pay', authorizeStaff('INVOICES'), invoiceController.pay);

router.get('/my', authorizeStaffOr('INVOICES', 'TENANT', 'LANDLORD'), invoiceController.getMyInvoices);

export default router;