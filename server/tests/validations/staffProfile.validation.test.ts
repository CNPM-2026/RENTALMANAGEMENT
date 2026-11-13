import { describe, expect, it } from 'vitest';
import {
  staffBrowseBodySchema,
  staffBrowseGetQuerySchema,
  staffProfileUpsertSchema,
} from '../../src/validations/staffProfile.validation';

/**
 * Lớp validate là chốt chặn số cuối cùng trước Prisma. Bộ test này khoá lại các
 * hành vi dễ hỏng nhất của input số/địa lý (cùng nhóm lỗi với bug nhập
 * điện/nước): chuỗi rỗng KHÔNG được thành 0, giá trị rác phải bị từ chối.
 */
describe('staffProfileUpsertSchema', () => {
  it('coi chuỗi rỗng là null (xoá giá trị) thay vì 0', () => {
    const parsed = staffProfileUpsertSchema.parse({ priceMin: '', latitude: '', longitude: '' });
    expect(parsed.priceMin).toBeNull();
    expect(parsed.latitude).toBeNull();
    expect(parsed.longitude).toBeNull();
  });

  it('từ chối giá trị không phải số thay vì âm thầm đổi thành 0/NaN', () => {
    expect(() => staffProfileUpsertSchema.parse({ priceMin: 'abc' })).toThrow();
    expect(() => staffProfileUpsertSchema.parse({ priceMin: '1.500.000' })).toThrow();
  });

  it('từ chối toạ độ ngoài phạm vi và trùng lặp ràng buộc cặp toạ độ', () => {
    expect(() => staffProfileUpsertSchema.parse({ latitude: 95, longitude: 106 })).toThrow();
    expect(() => staffProfileUpsertSchema.parse({ latitude: 10.7 })).toThrow();
    expect(staffProfileUpsertSchema.parse({ latitude: 10.7, longitude: 106.6 })).toMatchObject({
      latitude: 10.7,
      longitude: 106.6,
    });
  });

  it('loại bỏ kỹ năng trùng lặp và từ chối kỹ năng ngoài danh mục', () => {
    const parsed = staffProfileUpsertSchema.parse({ skills: ['ELECTRICAL', 'ELECTRICAL', 'CLEANING'] });
    expect(parsed.skills).toEqual(['ELECTRICAL', 'CLEANING']);
    expect(() => staffProfileUpsertSchema.parse({ skills: ['HACKING'] })).toThrow();
  });

  it('từ chối khoảng giá ngược', () => {
    expect(() => staffProfileUpsertSchema.parse({ priceMin: 500_000, priceMax: 100_000 })).toThrow();
    expect(staffProfileUpsertSchema.parse({ priceMin: 500_000, priceMax: 500_000 })).toMatchObject({
      priceMin: 500_000,
      priceMax: 500_000,
    });
  });

  it('giữ nguyên các trường khi không gửi (PUT bán phần)', () => {
    const parsed = staffProfileUpsertSchema.parse({});
    expect(parsed.description).toBeUndefined();
    expect(parsed.priceMin).toBeUndefined();
    expect(parsed.skills).toBeUndefined();
  });
});

describe('staffBrowseBodySchema', () => {
  it('parse tham số dạng chuỗi và boolean từ JSON body', () => {
    expect(staffBrowseBodySchema.parse({ page: '2', limit: '10', isAvailable: 'true' })).toMatchObject({
      page: 2,
      limit: 10,
      isAvailable: true,
    });
  });

  it('chặn limit quá lớn và category lạ', () => {
    expect(() => staffBrowseBodySchema.parse({ limit: '1000' })).toThrow();
    expect(() => staffBrowseBodySchema.parse({ category: 'UNKNOWN' })).toThrow();
  });
});

describe('staffBrowseBodySchema — dữ liệu vị trí chỉ đi qua POST body', () => {
  it('GET từ chối toạ độ/bán kính thay vì âm thầm bỏ qua', () => {
    expect(staffBrowseGetQuerySchema.safeParse({ latitude: '21.0278', longitude: '105.8342' }).success).toBe(false);
    expect(staffBrowseGetQuerySchema.safeParse({ radiusKm: '5' }).success).toBe(false);
    expect(staffBrowseGetQuerySchema.safeParse({ page: '2', sort: 'newest' }).success).toBe(true);
  });

  it('POST body parse toạ độ dạng số/chuỗi và giữ ràng buộc cặp + bán kính', () => {
    expect(
      staffBrowseBodySchema.parse({
        latitude: '21.0278',
        longitude: '105.8342',
        radiusKm: '5',
        sort: 'nearest',
        page: '2',
      }),
    ).toMatchObject({
      latitude: 21.0278,
      longitude: 105.8342,
      radiusKm: 5,
      sort: 'nearest',
      page: 2,
    });
    expect(staffBrowseBodySchema.safeParse({ latitude: 21.0278 }).success).toBe(false);
    expect(staffBrowseBodySchema.safeParse({ radiusKm: 5 }).success).toBe(false);
  });
});
