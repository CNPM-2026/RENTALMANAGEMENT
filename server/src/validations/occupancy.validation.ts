import { z } from 'zod';
import { strictInteger } from './numeric';

/**
 * KHAI BÁO SỐ NGƯỜI Ở — validation đầu vào (Occupancy).
 *
 * `strictInteger` từ chối chuỗi rỗng/`NaN`/`Infinity` và giữ nguyên `''` là
 * "không nhập" thay vì biến thành 0. Giới hạn trên 50 khớp
 * `MAX_OCCUPANTS_PER_DECLARATION`; ràng buộc thật (sức chứa phòng) được kiểm
 * tra ở service vì cần đọc DB.
 */
export const occupancyDeclarationSchema = z.object({
  roomId: z.string().uuid('ID phòng không hợp lệ'),
  occupants: strictInteger('Số người ở không hợp lệ')
    .pipe(z.number().positive('Số người ở phải lớn hơn 0').max(50, 'Số người ở tối đa là 50')),
});

/**
 * Từ chối khai báo: lý do BẮT BUỘC (≥ 3 ký tự). Không có lý do thì khách thuê
 * không biết cần sửa gì, và trạng thái REJECTED trở nên vô nghĩa.
 */
export const occupancyRejectionSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do từ chối phải có ít nhất 3 ký tự').max(2000),
});
