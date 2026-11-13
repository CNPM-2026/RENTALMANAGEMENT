import { z } from 'zod';
import { strictInteger, strictMoney } from './numeric';

/**
 * THƯƠNG LƯỢNG GIÁ (Batch 3).
 *
 * `amount` dùng `strictMoney` (không âm, tối đa 2 chữ số thập phân) rồi bắt buộc
 * > 0: đề xuất 0 đồng là vô nghĩa và sẽ làm `agreed_amount = 0` trông như "đã
 * chốt giá" trong khi thực tế là chưa có thoả thuận.
 */

export const MAX_OFFER_AMOUNT = 1_000_000_000;

export const offerAmountSchema = strictMoney({
  message: 'Giá đề xuất không hợp lệ',
  max: MAX_OFFER_AMOUNT,
}).pipe(z.number().positive('Giá đề xuất phải lớn hơn 0'));

const offerNote = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().max(1000, 'Ghi chú tối đa 1000 ký tự').nullable().optional(),
);

export const maintenanceOfferProposeSchema = z.object({
  amount: offerAmountSchema,
  note: offerNote,
});

/**
 * `expectedVersion` là tuỳ chọn nhưng được khuyến khích: client gửi phiên bản
 * thương lượng mà nó đang hiển thị, server từ chối nếu đã có quyết định mới hơn
 * (một tab cũ không thể áp quyết định lên trạng thái mới).
 */
export const maintenanceOfferDecisionSchema = z.object({
  expectedVersion: strictInteger('Phiên bản thương lượng không hợp lệ').pipe(z.number().nonnegative()).optional(),
  note: offerNote,
});

export type MaintenanceOfferProposeInput = z.infer<typeof maintenanceOfferProposeSchema>;
export type MaintenanceOfferDecisionInput = z.infer<typeof maintenanceOfferDecisionSchema>;
