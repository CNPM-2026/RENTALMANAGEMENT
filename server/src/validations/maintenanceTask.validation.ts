import { z } from 'zod';
import { SERVICE_CATEGORIES, serviceCategorySchema } from './staffProfile.validation';
import { minorToNumber, toMinorUnits } from '../utils/money';

/**
 * Validation cho MARKETPLACE CÔNG VIỆC BẢO TRÌ (Batch 2).
 *
 * Nguyên tắc giữ nguyên như `staffProfile.validation`:
 * - Trường số không dùng `z.coerce.number()` trần: chuỗi rỗng sẽ thành 0.
 * - `''`/`null` = "xoá giá trị", vắng mặt = "giữ nguyên" (PATCH bán phần).
 * - Dữ liệu gửi qua multipart (FormData) vẫn là chuỗi, nên mảng `skills` được
 *   chấp nhận ở 3 dạng: mảng thật, JSON string (`'["PLUMBING"]'`) hoặc CSV
 *   (`'PLUMBING,ELECTRICAL'`). Luôn dedupe trước khi ghi để không vi phạm
 *   PRIMARY KEY (task_id, category).
 */

const MAX_TASK_SKILLS = SERVICE_CATEGORIES.length;

const nullableNumber = (min: number, max: number, message: string) =>
  z.preprocess(
    (value) => (value === '' || value === null ? null : value),
    z.coerce
      .number({ message })
      .finite(message)
      .min(min, message)
      .max(max, message)
      .nullable()
      .optional(),
  );

const nullableText = (minLength: number, maxLength: number, message?: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().min(minLength, message).max(maxLength, message).nullable().optional(),
  );

/** Ngày giờ tuỳ chọn: `''`/`null` -> null, còn lại phải parse được. */
const nullableDate = (message: string) =>
  z.preprocess(
    (value) => (value === '' || value === null ? null : value),
    z.coerce.date({ message }).nullable().optional(),
  );

const skillsInput = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    if (trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return [trimmed];
      }
    }
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return value;
}, z
  .array(serviceCategorySchema)
  .max(MAX_TASK_SKILLS, 'Số kỹ năng yêu cầu vượt quá danh mục cho phép')
  .transform((categories) => Array.from(new Set(categories)))
  .optional());

/** Khung giờ bắt đầu không được ở quá khứ (tính từ đầu ngày hôm nay). */
const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const maintenanceTaskFields = {
  propertyId: z.string().uuid('ID cơ sở không hợp lệ'),
  // `''` = công việc ở khu vực chung của cơ sở, không gắn phòng cụ thể.
  roomId: z.preprocess(
    (value) => (value === '' || value === null ? null : value),
    z.string().uuid('ID phòng không hợp lệ').nullable().optional(),
  ),
  title: z.string().trim().min(5, 'Tiêu đề phải có ít nhất 5 ký tự').max(200),
  description: z.string().trim().min(20, 'Mô tả phải có ít nhất 20 ký tự').max(5000),
  category: serviceCategorySchema,
  skills: skillsInput,
  address: z.string().trim().min(5, 'Địa chỉ phải có ít nhất 5 ký tự').max(300),
  latitude: nullableNumber(-90, 90, 'Vĩ độ không hợp lệ'),
  longitude: nullableNumber(-180, 180, 'Kinh độ không hợp lệ'),
  budgetMin: nullableNumber(0, 1_000_000_000, 'Ngân sách tối thiểu không hợp lệ'),
  budgetMax: nullableNumber(0, 1_000_000_000, 'Ngân sách tối đa không hợp lệ'),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH'], { message: 'Mức độ khẩn cấp không hợp lệ' }).optional(),
  preferredStartAt: nullableDate('Thời gian bắt đầu mong muốn không hợp lệ'),
  preferredEndAt: nullableDate('Thời gian kết thúc mong muốn không hợp lệ'),
  additionalInstructions: nullableText(0, 2000, 'Hướng dẫn thêm tối đa 2000 ký tự'),
};

type MaintenanceTaskInput = z.infer<z.ZodObject<typeof maintenanceTaskFields>>;

/**
 * Các ràng buộc chéo trường. Dùng cho CẢ create và update nên mọi giá trị đều
 * có thể `undefined` (PATCH chỉ gửi phần thay đổi) — chỉ kiểm tra khi cả cặp
 * trường cùng có mặt.
 */
const applyTaskRules = (value: Partial<MaintenanceTaskInput>, ctx: z.RefinementCtx) => {
  const hasLatitude = Object.prototype.hasOwnProperty.call(value, 'latitude');
  const hasLongitude = Object.prototype.hasOwnProperty.call(value, 'longitude');

  // PATCH bán phần: gửi một trục mà bỏ trục kia sẽ để lại cặp toạ độ lệch
  // (một số + một NULL). Yêu cầu cập nhật/xoá CẢ CẶP trong cùng payload.
  if (hasLatitude !== hasLongitude) {
    ctx.addIssue({
      code: 'custom',
      message: 'Vĩ độ và kinh độ phải được cập nhật cùng nhau',
      path: [hasLatitude ? 'longitude' : 'latitude'],
    });
    return;
  }
  if ((value.latitude == null) !== (value.longitude == null)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Vĩ độ và kinh độ phải được cung cấp cùng nhau',
      path: ['longitude'],
    });
  }
  if (value.budgetMin != null && value.budgetMax != null && value.budgetMax < value.budgetMin) {
    ctx.addIssue({
      code: 'custom',
      message: 'Ngân sách tối đa phải lớn hơn hoặc bằng ngân sách tối thiểu',
      path: ['budgetMax'],
    });
  }
  if (value.preferredStartAt && value.preferredEndAt && value.preferredEndAt <= value.preferredStartAt) {
    ctx.addIssue({
      code: 'custom',
      message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
      path: ['preferredEndAt'],
    });
  }
  if (value.preferredStartAt && value.preferredStartAt < startOfToday()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Thời gian bắt đầu mong muốn không được ở quá khứ',
      path: ['preferredStartAt'],
    });
  }
  const maxPreferredDate = new Date();
  maxPreferredDate.setFullYear(maxPreferredDate.getFullYear() + 1);
  if (value.preferredEndAt && value.preferredEndAt > maxPreferredDate) {
    ctx.addIssue({
      code: 'custom',
      message: 'Thời gian kết thúc mong muốn không được vượt quá 1 năm',
      path: ['preferredEndAt'],
    });
  }
};

/**
 * 🆕 Batch 2 (điều chỉnh luồng, Variant B) — KHÔNG còn schema "tạo tự do".
 * Công việc chỉ được tạo từ sự cố nên mọi payload tạo đều đi qua
 * `maintenanceTaskFromIssueSchema` bên dưới; `maintenanceTaskUpdateSchema` giữ
 * nguyên cho PATCH bán phần.
 */
export const maintenanceTaskUpdateSchema = z
  .object(maintenanceTaskFields)
  .partial()
  .superRefine(applyTaskRules)
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Cần có ít nhất một trường cập nhật',
  });

/**
 * 🆕 Batch 2 (điều chỉnh luồng) — chủ trọ chuyển MỘT SỰ CỐ đã được khách thuê báo
 * thành công việc cần thợ.
 *
 * Cố ý KHÔNG nhận `propertyId`/`roomId`/`address`/toạ độ: nơi làm việc được suy
 * ra từ chính sự cố (phòng → cơ sở), nên chủ trọ không thể đăng việc lên cơ sở
 * khác hay địa chỉ khác với nơi khách thuê báo sự cố. Mọi trường còn lại là tuỳ
 * chọn: vắng mặt thì server lấy từ sự cố (tiêu đề, mô tả, danh mục, mức khẩn
 * cấp) — nhờ vậy form chuyển đổi có thể chỉ cần gửi phần chủ trọ sửa.
 */
export const maintenanceTaskFromIssueSchema = z
  .object({
    title: maintenanceTaskFields.title.optional(),
    description: maintenanceTaskFields.description.optional(),
    category: serviceCategorySchema.optional(),
    skills: skillsInput,
    budgetMin: maintenanceTaskFields.budgetMin,
    budgetMax: maintenanceTaskFields.budgetMax,
    urgency: maintenanceTaskFields.urgency,
    preferredStartAt: maintenanceTaskFields.preferredStartAt,
    preferredEndAt: maintenanceTaskFields.preferredEndAt,
    additionalInstructions: maintenanceTaskFields.additionalInstructions,
  })
  .superRefine(applyTaskRules);

const positiveIntQuery = z.coerce.number().int().min(1).max(1000).optional();

const coordinateQueryFields = {
  latitude: nullableNumber(-90, 90, 'Vĩ độ không hợp lệ'),
  longitude: nullableNumber(-180, 180, 'Kinh độ không hợp lệ'),
  radiusKm: nullableNumber(0.5, 200, 'Bán kính tìm kiếm phải từ 0.5 đến 200 km'),
};

/**
 * Kiểm tra cặp toạ độ của query. `sort=nearest`/`radiusKm` mà thiếu toạ độ là
 * lỗi 400 chứ KHÔNG được lặng lẽ bỏ qua: nếu bỏ qua, client sẽ tưởng đang xem
 * danh sách "gần nhất" trong khi thực tế là danh sách mặc định.
 */
const applyGeoRules = (
  value: { latitude?: number | null; longitude?: number | null; radiusKm?: number | null; sort?: string },
  ctx: z.RefinementCtx,
) => {
  if ((value.latitude == null) !== (value.longitude == null)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Vĩ độ và kinh độ phải được cung cấp cùng nhau',
      path: ['longitude'],
    });
    return;
  }
  if (value.radiusKm != null && value.latitude == null) {
    ctx.addIssue({
      code: 'custom',
      message: 'Cần toạ độ khi lọc theo bán kính',
      path: ['radiusKm'],
    });
  }
  if (value.sort === 'nearest' && value.latitude == null) {
    ctx.addIssue({
      code: 'custom',
      message: 'Cần toạ độ khi sắp xếp theo khoảng cách',
      path: ['sort'],
    });
  }
};

export const MAINTENANCE_TASK_SORTS = ['newest', 'nearest', 'urgency'] as const;

/**
 * 🆕 Batch 3 — MỌI trạng thái của công việc. Danh sách này là nguồn duy nhất
 * cho validation query; trước Batch 3 nó bị khai báo rải rác ở controller
 * (`OPEN | ASSIGNED | CANCELLED`), nên thêm trạng thái mới là phải sửa nhiều nơi
 * và dễ quên một chỗ (chỗ quên sẽ âm thầm trả 400 cho bộ lọc hợp lệ).
 */
export const MAINTENANCE_TASK_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'COMPLETED',
  'CANCELLED',
] as const;



/**
 * Filter KHÔNG nhạy cảm — an toàn khi nhận qua GET query string.
 *
 * `latitude`/`longitude`/`radiusKm` cố ý không nằm ở đây. CodeQL coi dữ liệu vị
 * trí đọc từ GET là nhạy cảm (có thể lộ qua access log, browser history,
 * referer), nên geo chỉ được nhận từ body của `POST /maintenance-tasks/browse`.
 */
const maintenanceTaskBrowseFilterFields = {
  category: serviceCategorySchema.optional(),
  // Kỹ năng cụ thể của thợ — khác `category` (danh mục của công việc).
  skill: serviceCategorySchema.optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  search: z.string().trim().max(100).optional(),
  page: positiveIntQuery,
  limit: positiveIntQuery,
};

/** GET chỉ nhận filter thường; `nearest` cần toạ độ nên chỉ có ở POST body. */
export const maintenanceTaskGetQuerySchema = z
  .object({
    ...maintenanceTaskBrowseFilterFields,
    sort: z.enum(['newest', 'urgency']).optional(),
  })
  // Từ chối geo trong GET thay vì âm thầm bỏ qua; client phải dùng POST body.
  .strict();

/** Body của `POST /maintenance-tasks/browse` (có dữ liệu vị trí nhạy cảm). */
export const maintenanceTaskBrowseBodySchema = z
  .object({
    ...maintenanceTaskBrowseFilterFields,
    ...coordinateQueryFields,
    sort: z.enum(MAINTENANCE_TASK_SORTS).optional(),
  })
  .superRefine(applyGeoRules);

export const maintenanceTaskListQuerySchema = z.object({
  status: z.enum(MAINTENANCE_TASK_STATUSES).optional(),
});

/** 🆕 Batch 3 — bộ lọc "việc của tôi" của thợ (mặc định: mọi trạng thái). */
export const maintenanceTaskAssignedQuerySchema = z.object({
  status: z.enum(MAINTENANCE_TASK_STATUSES).optional(),
});

export const maintenanceApplicationCreateSchema = z.object({
  message: nullableText(3, 2000, 'Lời nhắn phải có ít nhất 3 ký tự nếu gửi kèm'),
  // 🆕 Batch 3 — giá thợ đề nghị. Chủ trọ chấp nhận đơn = chấp nhận giá này
  // (xem `maintenanceApplication.service.accept`).
  proposedAmount: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z
      .preprocess(
        (value) => {
          if (typeof value !== 'string' || value.trim() === '') return value;
          const minor = toMinorUnits(value);
          return minor === null ? value : minorToNumber(minor);
        },
        z.number({ message: 'Giá đề nghị không hợp lệ' }).finite().positive('Giá đề nghị phải lớn hơn 0').max(1_000_000_000),
      )
      .optional(),
  ),
});

/**
 * 🆕 Batch 3 — thợ gửi nghiệm thu.
 *
 * `note` là ghi chú của thợ (tuỳ chọn). Ảnh bằng chứng là BẮT BUỘC, nhưng ràng
 * buộc "phải có ít nhất một ảnh" nằm ở service vì validation body không thấy
 * `req.files`.
 */
export const maintenanceTaskCompletionSchema = z.object({
  note: nullableText(0, 2000, 'Ghi chú nghiệm thu tối đa 2000 ký tự'),
});

/** Chủ trọ xác nhận hoàn thành: ghi chú tuỳ chọn. */
export const maintenanceCompletionConfirmSchema = z.object({
  note: nullableText(0, 1000, 'Ghi chú xác nhận tối đa 1000 ký tự'),
});

/**
 * Chủ trọ yêu cầu làm lại: BẮT BUỘC nêu lý do — thợ phải biết cần sửa gì, và
 * lý do được lưu vào audit log để không mất khi lần nộp sau ghi đè.
 */
export const maintenanceCompletionRejectSchema = z.object({
  reason: z
    .string({ message: 'Vui lòng nêu lý do yêu cầu làm lại' })
    .trim()
    .min(10, 'Lý do yêu cầu làm lại phải có ít nhất 10 ký tự')
    .max(1000, 'Lý do yêu cầu làm lại tối đa 1000 ký tự'),
});


export type MaintenanceTaskUpdateInput = z.infer<typeof maintenanceTaskUpdateSchema>;
export type MaintenanceTaskFromIssueInput = z.infer<typeof maintenanceTaskFromIssueSchema>;
export type MaintenanceTaskBrowseQuery = z.infer<typeof maintenanceTaskBrowseBodySchema>;
export type MaintenanceApplicationCreateInput = z.infer<typeof maintenanceApplicationCreateSchema>;
/** 🆕 Batch 3 */
export type MaintenanceTaskCompletionInput = z.infer<typeof maintenanceTaskCompletionSchema>;
export type MaintenanceCompletionConfirmInput = z.infer<typeof maintenanceCompletionConfirmSchema>;
export type MaintenanceCompletionRejectInput = z.infer<typeof maintenanceCompletionRejectSchema>;
