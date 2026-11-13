import { describe, expect, it } from 'vitest';
import {
  maintenanceApplicationCreateSchema,
  maintenanceTaskBrowseQuerySchema,
  maintenanceTaskUpdateSchema,
} from '../../src/validations/maintenanceTask.validation';

/**
 * Validation là lớp chặn cuối trước Prisma — đặc biệt quan trọng với payload
 * multipart, nơi mọi giá trị đến dưới dạng chuỗi. Các test dưới đây khoá lại
 * những quy ước dễ vỡ: `''` không được thành 0, mảng kỹ năng phải dedupe, và
 * cặp toạ độ luôn đi cùng nhau (kể cả khi PATCH chỉ gửi một trục).
 */
const base = {
  propertyId: '11111111-1111-4111-8111-111111111111',
  title: 'Sửa trần nhà tắm',
  description: 'Trần nhà tắm bị thấm nước, cần xử lý trước cuối tuần.',
  category: 'PLUMBING',
  address: '12 Nguyễn Trãi, Thanh Xuân, Hà Nội',
};

describe('maintenanceTaskUpdateSchema — nhập liệu từ form/multipart', () => {
  it('chấp nhận payload tối thiểu (urgency để service giữ nguyên)', () => {
    const parsed = maintenanceTaskUpdateSchema.parse(base);
    expect(parsed.category).toBe('PLUMBING');
    expect(parsed.urgency).toBeUndefined();
    expect(parsed.roomId).toBeUndefined();
  });

  it('đọc `skills` từ JSON string hoặc CSV (multipart) và dedupe trước khi ghi', () => {
    const fromJson = maintenanceTaskUpdateSchema.parse({
      ...base,
      skills: '["PLUMBING","PLUMBING","CLEANING"]',
    });
    expect(fromJson.skills).toEqual(['PLUMBING', 'CLEANING']);

    const fromCsv = maintenanceTaskUpdateSchema.parse({ ...base, skills: 'PLUMBING, CLEANING' });
    expect(fromCsv.skills).toEqual(['PLUMBING', 'CLEANING']);
  });

  it('từ chối mô tả quá ngắn, danh mục ngoài enum và ngân sách đảo ngược', () => {
    expect(maintenanceTaskUpdateSchema.safeParse({ ...base, description: 'ngắn' }).success).toBe(false);
    expect(maintenanceTaskUpdateSchema.safeParse({ ...base, category: 'ROOFING' }).success).toBe(false);
    expect(maintenanceTaskUpdateSchema.safeParse({ ...base, budgetMin: 900_000, budgetMax: 100_000 }).success).toBe(
      false,
    );
  });

  it('từ chối khung thời gian không hợp lý (kết thúc trước bắt đầu, hoặc ở quá khứ)', () => {
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 60 * 60 * 1000);
    expect(
      maintenanceTaskUpdateSchema.safeParse({
        ...base,
        preferredStartAt: start.toISOString(),
        preferredEndAt: end.toISOString(),
      }).success,
    ).toBe(false);
    expect(
      maintenanceTaskUpdateSchema.safeParse({ ...base, preferredStartAt: '2020-01-01T00:00:00.000Z' }).success,
    ).toBe(false);
  });

  it('không coi chuỗi rỗng là 0 khi nhập ngân sách', () => {
    const parsed = maintenanceTaskUpdateSchema.parse({ ...base, budgetMin: '', budgetMax: null });
    expect(parsed.budgetMin).toBeNull();
    expect(parsed.budgetMax).toBeNull();
  });
});

describe('maintenanceTaskUpdateSchema', () => {
  it('từ chối payload rỗng', () => {
    expect(maintenanceTaskUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('từ chối cập nhật lẻ một trục toạ độ (sẽ để lại cặp lệch)', () => {
    expect(maintenanceTaskUpdateSchema.safeParse({ latitude: 21 }).success).toBe(false);
    expect(maintenanceTaskUpdateSchema.safeParse({ latitude: null, longitude: null }).success).toBe(true);
    expect(maintenanceTaskUpdateSchema.safeParse({ title: 'Sửa trần nhà tắm tầng 2' }).success).toBe(true);
  });
});

describe('maintenanceTaskBrowseQuerySchema', () => {
  it('bắt buộc có toạ độ khi sắp xếp theo khoảng cách hoặc lọc bán kính', () => {
    expect(maintenanceTaskBrowseQuerySchema.safeParse({ sort: 'nearest' }).success).toBe(false);
    expect(maintenanceTaskBrowseQuerySchema.safeParse({ radiusKm: 5 }).success).toBe(false);
    expect(
      maintenanceTaskBrowseQuerySchema.safeParse({ latitude: '21.0278', longitude: '105.8342', sort: 'nearest', radiusKm: '5' })
        .success,
    ).toBe(true);
  });
});

describe('maintenanceApplicationCreateSchema', () => {
  it('lời nhắn rỗng được chuẩn hoá thành null, không phải chuỗi rỗng', () => {
    expect(maintenanceApplicationCreateSchema.parse({ message: '   ' }).message).toBeNull();
    expect(maintenanceApplicationCreateSchema.parse({ message: 'Tôi nhận việc' }).message).toBe('Tôi nhận việc');
  });
});
