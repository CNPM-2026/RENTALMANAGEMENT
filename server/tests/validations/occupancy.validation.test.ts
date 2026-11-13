import { describe, expect, it } from 'vitest';
import { occupancyDeclarationSchema, occupancyRejectionSchema } from '../../src/validations/occupancy.validation';
import { roomUpdateSchema } from '../../src/validations/resource.validation';

/**
 * VALIDATION của occupancy & cấu hình phòng.
 *
 * Cùng nhóm lỗi với bug điện/nước: chuỗi rỗng phải là "không nhập" (required sẽ
 * từ chối), giá trị rác/âm/thập phân không được âm thầm thành 0.
 */
const ROOM_ID = '11111111-1111-4111-8111-111111111111';

describe('occupancyDeclarationSchema', () => {
  it('nhận số nguyên dương (kể cả dạng chuỗi)', () => {
    expect(occupancyDeclarationSchema.parse({ roomId: ROOM_ID, occupants: 3 })).toEqual({
      roomId: ROOM_ID,
      occupants: 3,
    });
    expect(occupancyDeclarationSchema.parse({ roomId: ROOM_ID, occupants: '3' }).occupants).toBe(3);
  });

  it('từ chối rỗng / chữ / thập phân / 0 / âm', () => {
    for (const occupants of ['', '  ', 'abc', '1.5', 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        () => occupancyDeclarationSchema.parse({ roomId: ROOM_ID, occupants }),
        `occupants=${String(occupants)}`,
      ).toThrow();
    }
  });

  it('từ chối vượt 50 và roomId không phải UUID', () => {
    expect(() => occupancyDeclarationSchema.parse({ roomId: ROOM_ID, occupants: 51 })).toThrow();
    expect(() => occupancyDeclarationSchema.parse({ roomId: 'room-1', occupants: 2 })).toThrow();
  });
});

describe('occupancyRejectionSchema', () => {
  it('lý do bắt buộc và tối thiểu 3 ký tự', () => {
    expect(() => occupancyRejectionSchema.parse({ reason: '' })).toThrow();
    expect(() => occupancyRejectionSchema.parse({ reason: '  a ' })).toThrow();
    expect(occupancyRejectionSchema.parse({ reason: '  Sai số người  ' }).reason).toBe('Sai số người');
  });
});

describe('roomUpdateSchema', () => {
  it('nhận cấu hình điện/nước/sức chứa hợp lệ', () => {
    expect(
      roomUpdateSchema.parse({ electricityRate: '3500.55', waterRate: 15000, maxOccupants: '4' }),
    ).toMatchObject({ electricityRate: 3500.55, waterRate: 15000, maxOccupants: 4 });
  });

  it('sức chứa phải là số nguyên dương', () => {
    expect(() => roomUpdateSchema.parse({ maxOccupants: 0 })).toThrow();
    expect(() => roomUpdateSchema.parse({ maxOccupants: 2.5 })).toThrow();
    expect(() => roomUpdateSchema.parse({ maxOccupants: 51 })).toThrow();
  });

  it('giá âm hoặc rác bị từ chối, không thành 0', () => {
    expect(() => roomUpdateSchema.parse({ electricityRate: -1 })).toThrow();
    expect(() => roomUpdateSchema.parse({ waterRate: 'abc' })).toThrow();
  });

  it('payload rỗng bị từ chối', () => {
    expect(() => roomUpdateSchema.parse({})).toThrow();
  });

  it('null = bỏ cấu hình phí (được phép), không phải 0', () => {
    expect(roomUpdateSchema.parse({ electricityRate: null })).toMatchObject({ electricityRate: null });
  });
});
