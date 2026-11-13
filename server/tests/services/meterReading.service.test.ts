import { beforeEach, describe, expect, it, vi } from 'vitest';
import { meterReadingService } from '../../src/services/meterReading.service';

/**
 * CHỈ SỐ ĐIỆN NƯỚC — Prisma mock toàn bộ.
 *
 * Trọng tâm: không bao giờ tính lại tiêu thụ đã tính ở kỳ trước, và không bao
 * giờ âm thầm đổi dữ liệu bẩn thành 0.
 */
const mocks = vi.hoisted(() => ({
  roomFindUnique: vi.fn(),
  readingFindFirst: vi.fn(),
  readingFindUnique: vi.fn(),
  readingCreate: vi.fn(),
}));

vi.mock('../../src/config/db', () => ({
  default: {
    room: { findUnique: mocks.roomFindUnique },
    meterReading: {
      findFirst: mocks.readingFindFirst,
      findUnique: mocks.readingFindUnique,
      create: mocks.readingCreate,
    },
  },
}));

const LANDLORD_ID = 'landlord-1';
const ROOM_ID = '11111111-1111-4111-8111-111111111111';

const baseInput = (overrides: Record<string, unknown> = {}) => ({
  roomId: ROOM_ID,
  month: 11,
  year: 2026,
  electricityEnd: 500,
  waterEnd: 200,
  ...overrides,
});

const expectAppError = async (promise: Promise<unknown>, statusCode: number, code?: string) => {
  const matcher: Record<string, unknown> = { statusCode };
  if (code) matcher.code = code;
  await expect(promise).rejects.toMatchObject(matcher);
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.roomFindUnique.mockResolvedValue({
    id: ROOM_ID,
    property: { landlordId: LANDLORD_ID },
  });
  mocks.readingFindFirst.mockResolvedValue({
    electricityEnd: 400,
    waterEnd: 150,
    month: 10,
    year: 2026,
  });
  mocks.readingFindUnique.mockResolvedValue(null);
  mocks.readingCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'reading-1',
    ...data,
  }));
});

describe('meterReadingService.createReading', () => {
  it('bỏ trống chỉ số đầu kỳ -> lấy chỉ số cuối kỳ trước (không tính lại từ 0)', async () => {
    await meterReadingService.createReading(LANDLORD_ID, baseInput());

    expect(mocks.readingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        electricityStart: 400,
        electricityEnd: 500,
        waterStart: 150,
        waterEnd: 200,
      }),
    });
  });

  it('chỉ số đầu kỳ gửi kèm THẤP hơn kỳ trước -> 400 READING_ROLLBACK_NOT_SUPPORTED', async () => {
    await expectAppError(
      meterReadingService.createReading(LANDLORD_ID, baseInput({ electricityStart: 350 })),
      400,
      'READING_ROLLBACK_NOT_SUPPORTED',
    );
    expect(mocks.readingCreate).not.toHaveBeenCalled();
  });

  it('chỉ số nước đầu kỳ thấp hơn kỳ trước -> 400 READING_ROLLBACK_NOT_SUPPORTED', async () => {
    await expectAppError(
      meterReadingService.createReading(LANDLORD_ID, baseInput({ waterStart: 100 })),
      400,
      'READING_ROLLBACK_NOT_SUPPORTED',
    );
    expect(mocks.readingCreate).not.toHaveBeenCalled();
  });

  it('cuối kỳ nhỏ hơn đầu kỳ -> 400', async () => {
    await expectAppError(
      meterReadingService.createReading(
        LANDLORD_ID,
        baseInput({ electricityStart: 600, electricityEnd: 500 }),
      ),
      400,
    );
    expect(mocks.readingCreate).not.toHaveBeenCalled();
  });

  it('chỉ số thập phân/âm -> 400 READING_INVALID (không tự làm tròn)', async () => {
    await expectAppError(
      meterReadingService.createReading(LANDLORD_ID, baseInput({ electricityEnd: 500.5 })),
      400,
      'READING_INVALID',
    );
    await expectAppError(
      meterReadingService.createReading(LANDLORD_ID, baseInput({ waterEnd: -1 })),
      400,
      'READING_INVALID',
    );
    expect(mocks.readingCreate).not.toHaveBeenCalled();
  });

  it('đã ghi chỉ số tháng này -> 400, không ghi đè', async () => {
    mocks.readingFindUnique.mockResolvedValue({ id: 'existing' });

    await expectAppError(meterReadingService.createReading(LANDLORD_ID, baseInput()), 400);
    expect(mocks.readingCreate).not.toHaveBeenCalled();
  });

  it('phòng của chủ trọ khác -> 403', async () => {
    mocks.roomFindUnique.mockResolvedValue({ id: ROOM_ID, property: { landlordId: 'other' } });

    await expectAppError(meterReadingService.createReading(LANDLORD_ID, baseInput()), 403);
    expect(mocks.readingCreate).not.toHaveBeenCalled();
  });
});
