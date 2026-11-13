import { z } from 'zod';

/**
 * Validation cho hồ sơ THỢ ĐỘC LẬP (role = STAFF).
 *
 * Nguyên tắc parsing (quan trọng — đây là lớp chặn cuối trước Prisma):
 * - Trường số KHÔNG dùng `z.coerce.number()` trần: chuỗi rỗng sẽ bị ép thành 0.
 *   `toNumber` biến `''`/`null` thành `null` (nghĩa là "xoá giá trị") và để mọi
 *   giá trị không phải số ném lỗi validation thay vì âm thầm thành 0/NaN.
 * - `null` = xoá giá trị đã lưu; vắng mặt = giữ nguyên (PUT bán phần).
 */
export const SERVICE_CATEGORIES = [
  'ELECTRICAL',
  'PLUMBING',
  'WATER_LEAK',
  'FURNITURE',
  'AIR_CONDITIONER',
  'PAINTING',
  'CLEANING',
  'GENERAL_MAINTENANCE',
] as const;

export const serviceCategorySchema = z.enum(SERVICE_CATEGORIES);

/** Số tuỳ chọn: `''`/`null` -> null, còn lại phải là số hữu hạn trong khoảng. */
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

/** Chuỗi tuỳ chọn: `''` -> null (xoá), giới hạn độ dài. */
const nullableText = (minLength: number, maxLength: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().min(minLength).max(maxLength).nullable().optional(),
  );

export const staffProfileUpsertSchema = z
  .object({
    description: nullableText(20, 5000),
    serviceAddress: nullableText(5, 300),
    latitude: nullableNumber(-90, 90, 'Vĩ độ không hợp lệ'),
    longitude: nullableNumber(-180, 180, 'Kinh độ không hợp lệ'),
    priceMin: nullableNumber(0, 1_000_000_000, 'Giá tối thiểu không hợp lệ'),
    priceMax: nullableNumber(0, 1_000_000_000, 'Giá tối đa không hợp lệ'),
    isAvailable: z.boolean({ message: 'Trạng thái sẵn sàng phải là true/false' }).optional(),
    // Mảng rỗng = thợ tạm xoá hết kỹ năng (sẽ không xuất hiện trong kết quả
    // khám phá theo kỹ năng). Dedupe trước khi ghi để không vi phạm PK
    // (staff_profile_id, category).
    skills: z
      .array(serviceCategorySchema)
      .max(SERVICE_CATEGORIES.length, 'Số kỹ năng vượt quá danh mục cho phép')
      .transform((categories) => Array.from(new Set(categories)))
      .optional(),
  })
  .refine((value) => value.priceMin == null || value.priceMax == null || value.priceMax >= value.priceMin, {
    message: 'Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu',
    path: ['priceMax'],
  })
  .refine((value) => (value.latitude == null) === (value.longitude == null), {
    message: 'Vĩ độ và kinh độ phải được cung cấp cùng nhau',
    path: ['longitude'],
  });

export const staffAvailabilitySchema = z.object({
  isAvailable: z.boolean({ message: 'Trạng thái sẵn sàng phải là true/false' }),
});

/**
 * Sắp xếp danh sách thợ. `nearest` chỉ hợp lệ khi có toạ độ của chủ trọ — nếu
 * thiếu toạ độ, server trả 400 thay vì lặng lẽ trả danh sách sai thứ tự.
 */
export const STAFF_BROWSE_SORTS = ['newest', 'nearest'] as const;

export const staffBrowseQuerySchema = z
  .object({
    category: serviceCategorySchema.optional(),
    isAvailable: z
      .preprocess((value) => (value === 'true' ? true : value === 'false' ? false : value), z.boolean().optional()),
    search: z.string().trim().max(100).optional(),
    // Toạ độ của CHỦ TRỌ / bất động sản để tính khoảng cách. Không bao giờ được
    // dùng để suy ra toạ độ của thợ.
    latitude: nullableNumber(-90, 90, 'Vĩ độ không hợp lệ'),
    longitude: nullableNumber(-180, 180, 'Kinh độ không hợp lệ'),
    radiusKm: nullableNumber(0.5, 200, 'Bán kính tìm kiếm phải từ 0.5 đến 200 km'),
    sort: z.enum(STAFF_BROWSE_SORTS).optional(),
    page: z.coerce.number().int().min(1).max(1000).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.latitude == null) !== (value.longitude == null)) {
      ctx.addIssue({ code: 'custom', message: 'Vĩ độ và kinh độ phải được cung cấp cùng nhau', path: ['longitude'] });
      return;
    }
    if (value.radiusKm != null && value.latitude == null) {
      ctx.addIssue({ code: 'custom', message: 'Cần toạ độ khi lọc theo bán kính', path: ['radiusKm'] });
    }
    if (value.sort === 'nearest' && value.latitude == null) {
      ctx.addIssue({ code: 'custom', message: 'Cần toạ độ khi sắp xếp theo khoảng cách', path: ['sort'] });
    }
  });

export type StaffProfileUpsertInput = z.infer<typeof staffProfileUpsertSchema>;
