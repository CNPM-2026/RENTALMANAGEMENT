import { z } from 'zod';
import { serviceCategorySchema } from './staffProfile.validation';
import { strictInteger, strictMoney, strictNumber } from './numeric';
import { addDays, dateInput, endOfDay, startOfToday } from './date.validation';

const uuid = z.string().uuid('ID không hợp lệ');
const moneyAmount = strictMoney({ max: 100_000_000, message: 'Số tiền phải nhỏ hơn 100.000.000' });

/** Hợp đồng có thể lập chậm tối đa 30 ngày, nhưng không được lùi quá xa. */
const contractStartDate = dateInput('Ngày bắt đầu hợp đồng không hợp lệ')
  .refine(
    (value) => value.getTime() >= addDays(startOfToday(), -30).getTime(),
    'Ngày bắt đầu hợp đồng không được lùi quá 30 ngày',
  )
  .refine(
    (value) => value.getTime() <= endOfDay(addDays(new Date(), 365)).getTime(),
    'Ngày bắt đầu hợp đồng không được vượt quá 1 năm',
  );

const contractEndDate = dateInput('Ngày kết thúc hợp đồng không hợp lệ');

export const propertySchema = z.object({
  name: z.string().trim().min(2).max(150),
  address: z.string().trim().min(5).max(300),
  province: z.string().trim().min(1).max(100),
  district: z.string().trim().min(1).max(100),
  ward: z.string().trim().min(1).max(100),
  description: z.string().max(5000).optional(),
  rules: z.string().max(5000).optional(),
  latitude: strictNumber('Vĩ độ không hợp lệ').pipe(z.number().min(-90).max(90)).optional(),
  longitude: strictNumber('Kinh độ không hợp lệ').pipe(z.number().min(-180).max(180)).optional(),
});

export const roomSchema = z.object({
  propertyId: uuid,
  roomNumber: z.string().trim().min(1).max(30),
  priceMonthly: moneyAmount,
  priceYearly: moneyAmount.optional(),
  depositAmount: moneyAmount.optional(),
  electricityRate: moneyAmount.optional(),
  waterRate: moneyAmount.optional(),
  internetFee: moneyAmount.optional(),
  serviceFee: moneyAmount.optional(),
  parkingFee: moneyAmount.optional(),
  area: strictNumber('Diện tích không hợp lệ').pipe(z.number().positive('Diện tích phải lớn hơn 0')),
  maxOccupants: strictInteger('Số người tối đa không hợp lệ')
    .pipe(z.number().positive().max(50))
    .optional(),
  amenityIds: z.array(uuid).max(50).optional(),
});

/**
 * 🆕 Sửa phòng — dùng cho cấu hình giá điện/nước/sức chứa.
 * Tất cả trường đều TUỲ CHỌN nhưng phải có ít nhất một trường; giá trị `null`
 * cho các phí phụ = "bỏ cấu hình" (cột nullable trong DB), còn `''` được
 * `strictMoney` coi là "không nhập" và bị bỏ qua.
 */
export const roomUpdateSchema = z
  .object({
    roomNumber: z.string().trim().min(1).max(30).optional(),
    priceMonthly: moneyAmount.optional(),
    priceYearly: moneyAmount.nullable().optional(),
    depositAmount: moneyAmount.optional(),
    electricityRate: moneyAmount.nullable().optional(),
    waterRate: moneyAmount.nullable().optional(),
    internetFee: moneyAmount.nullable().optional(),
    serviceFee: moneyAmount.nullable().optional(),
    parkingFee: moneyAmount.nullable().optional(),
    area: strictNumber('Diện tích không hợp lệ')
      .pipe(z.number().positive('Diện tích phải lớn hơn 0'))
      .optional(),
    maxOccupants: strictInteger('Số người tối đa không hợp lệ')
      .pipe(z.number().positive('Số người tối đa phải lớn hơn 0').max(50))
      .optional(),
    amenityIds: z.array(uuid).max(50).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Cần có ít nhất một trường cập nhật',
  });

export const amenitySchema = z.object({
  name: z.string().trim().min(1).max(100),
  iconUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
});

export const kycSubmissionSchema = z.object({
  idNumber: z.string().trim().min(9).max(20),
  permanentAddress: z.string().trim().min(5).max(300),
});

export const contractSchema = z.object({
  roomId: uuid,
  tenantId: uuid,
  startDate: contractStartDate,
  endDate: contractEndDate.optional(),
  depositPaid: strictMoney({ message: 'Tiền đặt cọc không hợp lệ' }),
  monthlyRent: strictMoney({ message: 'Tiền thuê hàng tháng không hợp lệ' }),
  terms: z.string().max(10000).optional(),
}).refine((value) => !value.endDate || value.endDate > value.startDate, {
  message: 'Ngày kết thúc phải sau ngày bắt đầu',
  path: ['endDate'],
}).refine(
  (value) => !value.endDate || value.endDate.getTime() <= addDays(value.startDate, 365 * 5).getTime(),
  { message: 'Thời hạn hợp đồng không được vượt quá 5 năm', path: ['endDate'] },
);

export const contractStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED']),
});

const optionalDateInput = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  dateInput().optional(),
);

/** Một bên gửi yêu cầu chấm dứt; Admin duyệt hoặc từ chối. */
export const contractTerminationSchema = z.object({
  reason: z.enum(
    ['TENANT_MOVED_OUT', 'TENANT_VIOLATION', 'LANDLORD_VIOLATION', 'MUTUAL_AGREEMENT', 'OTHER'],
    { message: 'Lý do chấm dứt không hợp lệ' },
  ),
  details: z
    .string()
    .trim()
    .min(20, 'Mô tả chi tiết phải có ít nhất 20 ký tự')
    .max(5000, 'Mô tả chi tiết không được vượt quá 5000 ký tự'),
  requestedEffectiveDate: optionalDateInput.refine(
    (value) => !value || value.getTime() >= startOfToday().getTime(),
    'Ngày chấm dứt dự kiến không được ở quá khứ',
  ),
});

export const contractTerminationReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'], { message: 'Quyết định duyệt không hợp lệ' }),
  reviewNote: z
    .string()
    .trim()
    .min(10, 'Kết luận của Admin phải có ít nhất 10 ký tự')
    .max(3000),
  refundAmount: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    strictMoney({ message: 'Mức hoàn cọc không hợp lệ' }).optional(),
  ),
  effectiveDate: optionalDateInput,
});

export const contractTerminationQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
});

/** Một bên đề xuất ký tiếp; `proposedEndDate = null` nghĩa là vô thời hạn. */
export const contractRenewalSchema = z.object({
  proposedEndDate: z.preprocess(
    (value) => (value === '' || value === null ? null : value),
    dateInput('Ngày kết thúc mới không hợp lệ').nullable().optional(),
  ),
  proposedMonthlyRent: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    strictMoney({ message: 'Tiền thuê mới không hợp lệ' }).optional(),
  ),
  note: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(2000).nullable().optional(),
  ),
});

export const contractRenewalRespondSchema = z.object({
  status: z.enum(['APPROVED', 'DECLINED'], { message: 'Phản hồi gia hạn không hợp lệ' }),
  note: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(2000).nullable().optional(),
  ),
});

export const contractRenewalQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'DECLINED', 'CANCELLED']).optional(),
});

export const meterReadingSchema = z.object({
  roomId: uuid,
  month: strictInteger('Tháng không hợp lệ').pipe(z.number().min(1).max(12)),
  year: strictInteger('Năm không hợp lệ').pipe(z.number().min(2000).max(2200)),
  // Bắt buộc nhập chỉ số ĐẦU kỳ: trước Batch 7 client gửi cứng 0, khiến lượng
  // tiêu thụ bị tính từ 0 và hoá đơn sai. Server cũng chấp nhận thiếu START và
  // tự lấy chỉ số cuối của kỳ gần nhất (xem `meterReading.service.ts`).
  electricityStart: strictInteger('Chỉ số điện đầu kỳ không hợp lệ')
    .pipe(z.number().nonnegative('Chỉ số điện không được âm'))
    .optional(),
  electricityEnd: strictInteger('Chỉ số điện cuối kỳ không hợp lệ').pipe(
    z.number().nonnegative('Chỉ số điện không được âm'),
  ),
  waterStart: strictInteger('Chỉ số nước đầu kỳ không hợp lệ')
    .pipe(z.number().nonnegative('Chỉ số nước không được âm'))
    .optional(),
  waterEnd: strictInteger('Chỉ số nước cuối kỳ không hợp lệ').pipe(
    z.number().nonnegative('Chỉ số nước không được âm'),
  ),
}).refine((value) => value.electricityStart == null || value.electricityEnd >= value.electricityStart, {
  message: 'Chỉ số điện cuối kỳ phải lớn hơn hoặc bằng đầu kỳ',
  path: ['electricityEnd'],
}).refine((value) => value.waterStart == null || value.waterEnd >= value.waterStart, {
  message: 'Chỉ số nước cuối kỳ phải lớn hơn hoặc bằng đầu kỳ',
  path: ['waterEnd'],
});

export const invoiceSchema = z.object({
  roomId: uuid,
  month: strictInteger('Tháng không hợp lệ').pipe(z.number().min(1).max(12)),
  year: strictInteger('Năm không hợp lệ').pipe(z.number().min(2000).max(2200)),
  otherFee: strictMoney({ message: 'Phụ phí không hợp lệ', max: 100_000_000 }).optional(),
});

/**
 * 🆕 Xem trước hoá đơn (GET /invoices/preview). Query string nên dùng cùng bộ
 * chuẩn hoá với body: `''` là "không nhập" (không thành 0), `'abc'`/`NaN` bị từ
 * chối thay vì âm thầm thành 0.
 */
export const invoicePreviewSchema = z.object({
  roomId: uuid,
  month: strictInteger('Tháng không hợp lệ').pipe(z.number().min(1).max(12)),
  year: strictInteger('Năm không hợp lệ').pipe(z.number().min(2000).max(2200)),
  otherFee: strictMoney({ message: 'Phụ phí không hợp lệ', max: 100_000_000 }).optional(),
});


export const conversationSchema = z.object({ targetUserId: uuid });

/**
 * 🆕 Batch 5 — gửi tin nhắn qua HTTP.
 * `content` được phép rỗng KHI có tệp đính kèm (ràng buộc "văn bản hoặc ảnh" nằm
 * ở service vì validation body không thấy `req.files`).
 */
export const chatMessageSchema = z.object({
  content: z.preprocess(
    (value) => (value === undefined || value === null ? '' : value),
    z.string().max(5000, 'Nội dung tin nhắn tối đa 5000 ký tự'),
  ),
  clientMessageId: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(8).max(80).optional(),
  ),
});


export const reviewSchema = z.object({
  targetType: z.enum(['POST', 'USER', 'ROOM', 'TASK'], { message: 'Loại đối tượng đánh giá không hợp lệ' }),
  targetId: uuid,
  rating: strictInteger('Điểm đánh giá không hợp lệ').pipe(z.number().min(1).max(5)),
  comment: z.string().max(2000).optional(),
});

export const reportSchema = z.object({
  targetType: z.enum(['POST', 'USER', 'ROOM', 'TASK'], { message: 'Đối tượng báo cáo không hợp lệ' }),
  targetId: uuid,
  // 🆕 Batch 4 — phân loại tranh chấp + công việc liên quan (nếu có).
  category: z
    .enum([
      'WORK_QUALITY',
      'NO_SHOW',
      'PRICE_DISPUTE',
      'SAFETY',
      'HARASSMENT',
      'FRAUD',
      'PROPERTY_DAMAGE',
      'OTHER',
    ])
    .optional(),
  taskId: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    uuid.optional(),
  ),
  reason: z.string().trim().min(10, 'Mô tả phải có ít nhất 10 ký tự').max(2000),
});

export const reportStatusSchema = z
  .object({
    status: z.enum(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'], {
      message: 'Trạng thái xử lý không hợp lệ',
    }),
    resolution: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
      z.string().trim().min(10, 'Kết luận phải có ít nhất 10 ký tự').max(2000).nullable().optional(),
    ),
  })
  .refine((value) => !['RESOLVED', 'REJECTED'].includes(value.status) || Boolean(value.resolution), {
    message: 'Cần nêu kết luận khi giải quyết hoặc bác bỏ báo cáo',
    path: ['resolution'],
  });

const postWriteFields = {
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(10000),
  price: moneyAmount.optional(),
  postType: z.enum(['RENT_OUT', 'FIND_ROOM', 'FIND_ROOMMATE']),
  propertyId: uuid.optional(),
  roomId: uuid.optional(),
  // Tin ở ghép có thể đặt hạn hiển thị; bỏ trống server mặc định 30 ngày.
  expiredAt: dateInput('Hạn đăng tin không hợp lệ')
    .refine(
      (value) => value.getTime() > Date.now() + 60 * 60 * 1000,
      'Hạn đăng tin phải sau thời điểm hiện tại ít nhất 1 tiếng',
    )
    .refine(
      (value) => value.getTime() <= endOfDay(addDays(new Date(), 180)).getTime(),
      'Hạn đăng tin không được vượt quá 180 ngày',
    )
    .optional(),
};

const validateRentOutPost = (value: z.infer<z.ZodObject<typeof postWriteFields>>, ctx: z.RefinementCtx) => {
  if (value.postType === 'RENT_OUT' && !value.roomId) {
    ctx.addIssue({ code: 'custom', message: 'Tin cho thuê phải gắn với một phòng', path: ['roomId'] });
  }
  if (value.postType === 'RENT_OUT' && !value.propertyId) {
    ctx.addIssue({ code: 'custom', message: 'Tin cho thuê phải gắn với nhà trọ', path: ['propertyId'] });
  }
};

export const postWriteSchema = z.object(postWriteFields).superRefine(validateRentOutPost);
export const postUpdateSchema = z.object(postWriteFields).partial();

export const supportCreateSchema = z.object({
  roomId: uuid.optional(),
  category: z.string().trim().min(2).max(40),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(10000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export const supportUpdateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  adminReply: z.string().trim().max(10000).optional(),
}).refine((value) => value.status !== undefined || value.adminReply !== undefined, {
  message: 'Cần có trạng thái hoặc nội dung phản hồi',
});

export const staffInviteSchema = z.object({
  email: z.string().email(),
  permissions: z.array(z.enum(['PROPERTIES_ROOMS', 'MAINTENANCE', 'INVOICES', 'APPOINTMENTS'])).min(1),
});

export const staffUpdateSchema = z.object({
  permissions: z.array(z.enum(['PROPERTIES_ROOMS', 'MAINTENANCE', 'INVOICES', 'APPOINTMENTS'])).min(1).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => value.permissions !== undefined || value.isActive !== undefined, {
  message: 'Cần có ít nhất một trường cập nhật',
});

export const maintenanceCreateSchema = z.object({
  roomId: uuid,
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(10000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  // 🆕 Batch 2 (điều chỉnh luồng) — danh mục sự cố, dùng để gợi ý danh mục cho
  // công việc khi chủ trọ chuyển báo cáo thành việc cần thợ. Tuỳ chọn để không
  // phá vỡ client cũ.
  category: serviceCategorySchema.optional(),
});

/**
 * 🆕 Batch 2 (điều chỉnh luồng) — chủ trọ TIẾP NHẬN báo cáo sự cố.
 * `NEEDS_INFO`/`REJECTED` bắt buộc có lý do: khách thuê phải biết cần bổ sung gì
 * hoặc vì sao bị từ chối, nếu không thì trạng thái này vô nghĩa với họ.
 */
export const maintenanceTriageSchema = z
  .object({
    triageStatus: z.enum(['PENDING', 'REVIEWED', 'NEEDS_INFO', 'REJECTED'], {
      message: 'Trạng thái tiếp nhận không hợp lệ',
    }),
    triageNote: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
      z.string().trim().min(3, 'Lý do phải có ít nhất 3 ký tự').max(2000).nullable().optional(),
    ),
  })
  .refine(
    (value) => !['NEEDS_INFO', 'REJECTED'].includes(value.triageStatus) || Boolean(value.triageNote),
    { message: 'Cần nêu lý do khi yêu cầu bổ sung thông tin hoặc từ chối', path: ['triageNote'] },
  );

export const maintenanceStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

export const rentalRequestCreateSchema = z.object({
  roomId: uuid,
  moveInDate: dateInput('Ngày dọn vào không hợp lệ')
    .refine(
      (value) => value.getTime() > startOfToday().getTime(),
      'Ngày dọn vào phải sau ngày hiện tại',
    )
    .refine(
      (value) => value.getTime() <= endOfDay(addDays(new Date(), 365)).getTime(),
      'Ngày dọn vào không được vượt quá 1 năm',
    ),
  leaseTermMonths: z.coerce.number().int().positive().max(120),
  occupantsCount: z.coerce.number().int().positive().max(50).optional(),
  note: z.string().trim().max(5000).optional(),
});

export const rentalRequestStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED', 'SIGNED']),
});

export const roommateInvitationCreateSchema = z.object({
  recipientId: uuid,
  postId: uuid.optional(),
  message: z.string().trim().max(2000).optional(),
});

export const roommateInvitationStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED', 'CANCELLED']),
});
