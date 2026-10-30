import { z } from 'zod';

const uuid = z.string().uuid('ID không hợp lệ');
const positiveNumber = z.coerce.number().finite().nonnegative();

export const propertySchema = z.object({
  name: z.string().trim().min(2).max(150),
  address: z.string().trim().min(5).max(300),
  province: z.string().trim().min(1).max(100),
  district: z.string().trim().min(1).max(100),
  ward: z.string().trim().min(1).max(100),
  description: z.string().max(5000).optional(),
  rules: z.string().max(5000).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const roomSchema = z.object({
  propertyId: uuid,
  roomNumber: z.string().trim().min(1).max(30),
  priceMonthly: positiveNumber,
  priceYearly: positiveNumber.optional(),
  depositAmount: positiveNumber.optional(),
  area: z.coerce.number().finite().positive(),
  maxOccupants: z.coerce.number().int().positive().max(50).optional(),
  amenityIds: z.array(uuid).max(50).optional(),
});

export const contractSchema = z.object({
  roomId: uuid,
  tenantId: uuid,
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  depositPaid: positiveNumber,
  monthlyRent: positiveNumber,
  terms: z.string().max(10000).optional(),
}).refine((value) => !value.endDate || value.endDate > value.startDate, {
  message: 'Ngày kết thúc phải sau ngày bắt đầu',
  path: ['endDate'],
});

export const contractStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED']),
});

export const meterReadingSchema = z.object({
  roomId: uuid,
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2200),
  electricityStart: z.coerce.number().int().nonnegative(),
  electricityEnd: z.coerce.number().int().nonnegative(),
  waterStart: z.coerce.number().int().nonnegative(),
  waterEnd: z.coerce.number().int().nonnegative(),
}).refine((value) => value.electricityEnd >= value.electricityStart, {
  message: 'Chỉ số điện cuối kỳ phải lớn hơn hoặc bằng đầu kỳ',
  path: ['electricityEnd'],
}).refine((value) => value.waterEnd >= value.waterStart, {
  message: 'Chỉ số nước cuối kỳ phải lớn hơn hoặc bằng đầu kỳ',
  path: ['waterEnd'],
});

export const invoiceSchema = z.object({
  roomId: uuid,
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2200),
  otherFee: positiveNumber.optional(),
});

export const conversationSchema = z.object({ targetUserId: uuid });

export const reviewSchema = z.object({
  targetType: z.enum(['POST', 'USER', 'ROOM']),
  targetId: uuid,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export const reportSchema = z.object({
  targetType: z.enum(['POST', 'USER', 'ROOM']),
  targetId: uuid,
  reason: z.string().trim().min(5).max(2000),
});

export const reportStatusSchema = z.object({
  status: z.enum(['PENDING', 'RESOLVED']),
});

export const postWriteSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(10000),
  price: positiveNumber.optional(),
  postType: z.enum(['RENT_OUT', 'FIND_ROOM', 'FIND_ROOMMATE']),
  propertyId: uuid.optional(),
  roomId: uuid.optional(),
});
