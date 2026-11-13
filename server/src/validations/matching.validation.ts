import { z } from 'zod';
import { addDays, endOfDay, startOfToday } from './date.validation';

export const matchingAnswersSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    optionId: z.string().uuid(),
  })).min(1).max(100),
});

export const matchingPreferencesSchema = z.object({
  budgetMin: z.coerce.number().finite().nonnegative().optional(),
  budgetMax: z.coerce.number().finite().nonnegative().optional(),
  preferredGender: z.enum(['MALE', 'FEMALE', 'OTHER', 'ANY']).optional(),
  preferredProvince: z.string().trim().max(100).optional(),
  preferredDistrict: z.string().trim().max(100).optional(),
  preferredWard: z.string().trim().max(100).optional(),
  hasRoom: z.boolean().optional(),
  currentProvince: z.string().trim().max(100).optional(),
  currentDistrict: z.string().trim().max(100).optional(),
  currentWard: z.string().trim().max(100).optional(),
  currentAddress: z.string().trim().max(300).optional(),
  currentRent: z.coerce.number().finite().nonnegative().optional(),
  currentArea: z.coerce.number().finite().positive().optional(),
  currentOccupants: z.coerce.number().int().positive().max(50).optional(),
  roommateSlots: z.coerce.number().int().positive().max(50).optional(),
  moveInDate: z.coerce
    .date({ message: 'Ngày dự kiến dọn vào không hợp lệ' })
    .refine(
      (value) => value.getTime() >= startOfToday().getTime(),
      'Ngày dự kiến dọn vào không được ở quá khứ',
    )
    .refine(
      (value) => value.getTime() <= endOfDay(addDays(new Date(), 730)).getTime(),
      'Ngày dự kiến dọn vào không được vượt quá 2 năm',
    )
    .optional(),
  smokingAllowed: z.boolean().optional(),
  petAllowed: z.boolean().optional(),
  cleanlinessLevel: z.coerce.number().int().min(1).max(5).optional(),
  sleepSchedule: z.string().trim().max(30).optional(),
  occupationPreference: z.string().trim().max(100).optional(),
  note: z.string().max(2000).optional(),
}).refine((value) => value.budgetMin === undefined || value.budgetMax === undefined || value.budgetMin <= value.budgetMax, {
  message: 'Ngân sách tối thiểu phải nhỏ hơn hoặc bằng ngân sách tối đa',
  path: ['budgetMax'],
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Cần cung cấp ít nhất một tiêu chí tìm kiếm',
});

const optionalBooleanQuery = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}, z.boolean().optional());

export const roommatePostSearchSchema = z.object({
  keyword: z.string().trim().max(200).optional(),
  province: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  ward: z.string().trim().max(100).optional(),
  minPrice: z.coerce.number().finite().nonnegative().optional(),
  maxPrice: z.coerce.number().finite().nonnegative().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  hasRoom: optionalBooleanQuery,
  sleepSchedule: z.string().trim().max(30).optional(),
  smokingAllowed: optionalBooleanQuery,
  petAllowed: optionalBooleanQuery,
  minCleanliness: z.coerce.number().int().min(1).max(5).optional(),
  sortBy: z.enum(['best_match', 'newest', 'price_asc', 'price_desc']).default('best_match'),
  limit: z.coerce.number().int().min(1).max(100).default(60),
}).refine((value) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice, {
  message: 'Ngân sách tối thiểu phải nhỏ hơn hoặc bằng ngân sách tối đa',
  path: ['maxPrice'],
});

const lifestyleOptionInputSchema = z.object({
  id: z.string().uuid().optional(),
  optionText: z.string().trim().min(1, 'Nội dung lựa chọn không được để trống').max(200),
  scoreValue: z.coerce.number().int().min(0).max(100),
});

export const lifestyleQuestionCreateSchema = z.object({
  questionText: z.string().trim().min(5, 'Câu hỏi phải có ít nhất 5 ký tự').max(300),
  category: z.string().trim().min(2, 'Danh mục phải có ít nhất 2 ký tự').max(50),
  weight: z.coerce.number().int().min(1).max(10).default(1),
  options: z.array(lifestyleOptionInputSchema).min(2, 'Cần ít nhất 2 lựa chọn').max(10, 'Tối đa 10 lựa chọn'),
});

export const lifestyleQuestionUpdateSchema = z.object({
  questionText: z.string().trim().min(5, 'Câu hỏi phải có ít nhất 5 ký tự').max(300).optional(),
  category: z.string().trim().min(2, 'Danh mục phải có ít nhất 2 ký tự').max(50).optional(),
  weight: z.coerce.number().int().min(1).max(10).optional(),
  options: z.array(lifestyleOptionInputSchema).min(2, 'Cần ít nhất 2 lựa chọn').max(10, 'Tối đa 10 lựa chọn').optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Cần cung cấp ít nhất một trường cập nhật',
});
