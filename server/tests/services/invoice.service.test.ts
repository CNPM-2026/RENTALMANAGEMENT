import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { invoiceService } from '../../src/services/invoice.service';

/**
 * HOÁ ĐƠN (Batch Occupancy/Invoice) — Prisma + occupancy mock toàn bộ.
 *
 * Bất biến:
 *  - điện = (cuối − đầu) × đơn giá phòng;
 *  - nước = đơn giá phòng × số người ĐÃ XÁC MINH;
 *  - không có bản xác minh ⇒ mặc định 1 người, vẫn phát hành hoá đơn;
 *  - snapshot (chỉ số, đơn giá, số người) được ghi cùng hoá đơn và KHÔNG bị
 *    thay đổi bởi lần tính sau;
 *  - tiền tính trên minor units ⇒ `3500.55 × 3` = `10501.65`, không lỗi float;
 *  - phí internet/dịch vụ/gửi xe lấy từ cấu hình phòng, snapshot vào hoá đơn;
 *  - đầu vào rỗng/không hợp lệ/âm không bao giờ thành 0 (trừ `otherFee` bỏ trống).
 */
const mocks = vi.hoisted(() => ({
  roomFindUnique: vi.fn(),
  contractFindFirst: vi.fn(),
  invoiceFindUnique: vi.fn(),
  invoiceCreate: vi.fn(),
  invoiceUpdate: vi.fn(),
  meterReadingFindUnique: vi.fn(),
  resolveOccupancy: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../src/config/db', () => ({
  default: {
    room: { findUnique: mocks.roomFindUnique },
    contract: { findFirst: mocks.contractFindFirst },
    invoice: {
      findUnique: mocks.invoiceFindUnique,
      create: mocks.invoiceCreate,
      update: mocks.invoiceUpdate,
    },
    meterReading: { findUnique: mocks.meterReadingFindUnique },
  },
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { createNotification: mocks.notify },
}));

vi.mock('../../src/services/occupancy.service', () => ({
  billingPeriodEnd: (month: number, year: number) => new Date(year, month, 0, 23, 59, 59, 999),
  occupancyService: { resolveVerifiedOccupancy: mocks.resolveOccupancy },
}));

const LANDLORD_ID = 'landlord-1';
const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';

const roomRow = (overrides: Record<string, unknown> = {}) => ({
  id: ROOM_ID,
  roomNumber: 'P101',
  electricityRate: new Prisma.Decimal('3500.55'),
  waterRate: new Prisma.Decimal('15000.00'),
  property: { landlordId: LANDLORD_ID },
  ...overrides,
});

const contractRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'contract-1',
  tenantId: TENANT_ID,
  monthlyRent: new Prisma.Decimal('3000000.00'),
  ...overrides,
});

const readingRow = (overrides: Record<string, unknown> = {}) => ({
  electricityStart: 100,
  electricityEnd: 112,
  waterStart: 50,
  waterEnd: 54,
  ...overrides,
});

const verifiedOccupancy = (occupants = 3) => ({
  declarationId: 'declaration-1',
  occupants,
  verifiedAt: new Date('2026-11-02T00:00:00Z'),
});

const input = (overrides: Record<string, unknown> = {}) => ({
  roomId: ROOM_ID,
  month: 11,
  year: 2026,
  ...overrides,
});

const createdInvoice = (data: Record<string, unknown>) => ({
  id: 'invoice-1',
  month: 11,
  year: 2026,
  ...data,
  room: { roomNumber: 'P101' },
  tenant: { fullName: 'Nguyễn Văn A' },
});

const expectAppError = async (promise: Promise<unknown>, statusCode: number, code?: string) => {
  const matcher: Record<string, unknown> = { statusCode };
  if (code) matcher.code = code;
  await expect(promise).rejects.toMatchObject(matcher);
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.roomFindUnique.mockResolvedValue(roomRow());
  mocks.contractFindFirst.mockResolvedValue(contractRow());
  mocks.invoiceFindUnique.mockResolvedValue(null);
  mocks.meterReadingFindUnique.mockResolvedValue(readingRow());
  mocks.resolveOccupancy.mockResolvedValue(verifiedOccupancy());
  mocks.notify.mockResolvedValue({ id: 'notification-1' });
  mocks.invoiceCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    createdInvoice(data),
  );
});

describe('invoiceService.generateInvoice — điện', () => {
  it('điện = (cuối − đầu) × đơn giá phòng; nước = đơn giá × số người đã xác minh', async () => {
    await invoiceService.generateInvoice(LANDLORD_ID, input());

    const { data } = mocks.invoiceCreate.mock.calls[0][0];
    // 12 kWh × 3.500,55 = 42.006,60
    expect(data.electricityFee).toBe('42006.60');
    // 3 người × 15.000 = 45.000
    expect(data.waterFee).toBe('45000.00');
    expect(data.roomFee).toBe('3000000.00');
    expect(data.otherFee).toBe('0.00');
    expect(data.totalAmount).toBe('3087006.60');
  });

  it('ghi đủ snapshot: chỉ số, đơn giá, số người, declaration id', async () => {
    await invoiceService.generateInvoice(LANDLORD_ID, input());

    const { data } = mocks.invoiceCreate.mock.calls[0][0];
    expect(data).toMatchObject({
      electricityStart: 100,
      electricityEnd: 112,
      electricityConsumption: 12,
      waterConsumption: 4,
      waterOccupants: 3,
      electricityUnitPrice: '3500.55',
      waterUnitPrice: '15000.00',
      occupancyDeclarationId: 'declaration-1',
      tenantId: TENANT_ID,
      status: 'UNPAID',
    });
  });

  it('đơn giá thiếu ở phòng -> dùng mức mặc định đang áp dụng và ghi vào snapshot', async () => {
    mocks.roomFindUnique.mockResolvedValue(roomRow({ electricityRate: null, waterRate: null }));

    await invoiceService.generateInvoice(LANDLORD_ID, input());

    const { data } = mocks.invoiceCreate.mock.calls[0][0];
    expect(data.electricityUnitPrice).toBe('3500.00');
    expect(data.waterUnitPrice).toBe('15000.00');
    expect(data.electricityFee).toBe('42000.00');
    expect(data.waterFee).toBe('45000.00');
  });

  it('sai số dấu phẩy động: 3 kWh × 3.500,55 = 10.501,65 chính xác', async () => {
    mocks.meterReadingFindUnique.mockResolvedValue(readingRow({ electricityStart: 10, electricityEnd: 13 }));

    await invoiceService.generateInvoice(LANDLORD_ID, input());

    expect(mocks.invoiceCreate.mock.calls[0][0].data.electricityFee).toBe('10501.65');
  });

  it('chỉ số cuối nhỏ hơn đầu kỳ -> 400 READING_INVALID, không ghi', async () => {
    mocks.meterReadingFindUnique.mockResolvedValue(readingRow({ electricityStart: 200, electricityEnd: 150 }));

    await expectAppError(invoiceService.generateInvoice(LANDLORD_ID, input()), 400, 'READING_INVALID');
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });

  it('thiếu chỉ số tháng -> 400 READING_REQUIRED, không ghi', async () => {
    mocks.meterReadingFindUnique.mockResolvedValue(null);

    await expectAppError(invoiceService.generateInvoice(LANDLORD_ID, input()), 400, 'READING_REQUIRED');
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });

  it('chỉ số âm (dữ liệu bẩn) -> 400 READING_INVALID', async () => {
    mocks.meterReadingFindUnique.mockResolvedValue(readingRow({ electricityStart: -1 }));

    await expectAppError(invoiceService.generateInvoice(LANDLORD_ID, input()), 400, 'READING_INVALID');
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });
});


describe('invoiceService.generateInvoice — nước theo số người đã xác minh', () => {
  it('chưa có bản xác minh -> mặc định 1 người, vẫn ghi hoá đơn', async () => {
    mocks.resolveOccupancy.mockResolvedValue(null);

    await invoiceService.generateInvoice(LANDLORD_ID, input());

    expect(mocks.invoiceCreate).toHaveBeenCalledTimes(1);
    expect(mocks.invoiceCreate.mock.calls[0][0].data).toMatchObject({
      waterOccupants: 1,
      // 1 người × 15.000 = 15.000
      waterFee: '15000.00',
      occupancyDeclarationId: null,
    });
  });

  it('dùng đúng số người đã xác minh (không dùng sức chứa phòng)', async () => {
    mocks.resolveOccupancy.mockResolvedValue(verifiedOccupancy(2));

    await invoiceService.generateInvoice(LANDLORD_ID, input());

    expect(mocks.resolveOccupancy).toHaveBeenCalledWith({
      roomId: ROOM_ID,
      tenantId: TENANT_ID,
      month: 11,
      year: 2026,
    });
    expect(mocks.invoiceCreate.mock.calls[0][0].data).toMatchObject({
      waterOccupants: 2,
      waterFee: '30000.00',
    });
  });

  it('số người thay đổi sau khi phát hành -> hoá đơn cũ giữ snapshot, không bị sửa', async () => {
    await invoiceService.generateInvoice(LANDLORD_ID, input());
    const firstSnapshot = mocks.invoiceCreate.mock.calls[0][0].data;

    // Tháng sau tenant khai thêm người và chủ trọ xác minh 5 người.
    mocks.resolveOccupancy.mockResolvedValue(verifiedOccupancy(5));
    // Hoá đơn tháng 11 đã tồn tại -> mọi lần tính lại bị chặn, KHÔNG update.
    mocks.invoiceFindUnique.mockResolvedValue({ id: 'invoice-1' });

    await expectAppError(invoiceService.generateInvoice(LANDLORD_ID, input()), 409, 'INVOICE_EXISTS');

    expect(firstSnapshot).toMatchObject({ waterOccupants: 3, waterFee: '45000.00' });
    expect(mocks.invoiceCreate).toHaveBeenCalledTimes(1);
    expect(mocks.invoiceUpdate).not.toHaveBeenCalled();
  });
});

describe('invoiceService.generateInvoice — đầu vào khác', () => {
  it('phụ phí "abc" -> 400 INVALID_OTHER_FEE (không âm thầm thành 0)', async () => {
    await expectAppError(
      invoiceService.generateInvoice(LANDLORD_ID, input({ otherFee: 'abc' })),
      400,
      'INVALID_OTHER_FEE',
    );
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });

  it('phụ phí âm -> 400 INVALID_OTHER_FEE', async () => {
    await expectAppError(
      invoiceService.generateInvoice(LANDLORD_ID, input({ otherFee: -5000 })),
      400,
      'INVALID_OTHER_FEE',
    );
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });

  it('phụ phí bỏ trống -> 0 đồng (đúng nghĩa "không nhập")', async () => {
    await invoiceService.generateInvoice(LANDLORD_ID, input({ otherFee: '' }));

    expect(mocks.invoiceCreate.mock.calls[0][0].data.otherFee).toBe('0.00');
  });

  it('cộng phí internet/dịch vụ/gửi xe đã cấu hình trên phòng vào tổng hoá đơn', async () => {
    mocks.roomFindUnique.mockResolvedValue(
      roomRow({
        internetFee: new Prisma.Decimal('100000.00'),
        serviceFee: new Prisma.Decimal('50000.00'),
        parkingFee: new Prisma.Decimal('30000.00'),
      }),
    );

    await invoiceService.generateInvoice(LANDLORD_ID, input());

    expect(mocks.invoiceCreate.mock.calls[0][0].data).toMatchObject({
      internetFee: '100000.00',
      serviceFee: '50000.00',
      parkingFee: '30000.00',
      // 3.000.000 + 42.006,60 điện + 45.000 nước + 180.000 phí cố định.
      totalAmount: '3267006.60',
    });
  });

  it('phòng chưa cấu hình phí cố định -> ghi 0, tổng không đổi', async () => {
    mocks.roomFindUnique.mockResolvedValue(
      roomRow({ internetFee: null, serviceFee: null, parkingFee: null }),
    );

    await invoiceService.generateInvoice(LANDLORD_ID, input());

    expect(mocks.invoiceCreate.mock.calls[0][0].data).toMatchObject({
      internetFee: '0.00',
      serviceFee: '0.00',
      parkingFee: '0.00',
      totalAmount: '3087006.60',
    });
  });

  it('phí cố định của phòng âm (dữ liệu bẩn) -> 400 INVALID_ROOM_EXTRA_FEE', async () => {
    mocks.roomFindUnique.mockResolvedValue(
      roomRow({ parkingFee: new Prisma.Decimal('-1.00') }),
    );

    await expectAppError(
      invoiceService.generateInvoice(LANDLORD_ID, input()),
      400,
      'INVALID_ROOM_EXTRA_FEE',
    );
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });

  it('không có hợp đồng ACTIVE -> 400 CONTRACT_REQUIRED', async () => {
    mocks.contractFindFirst.mockResolvedValue(null);

    await expectAppError(invoiceService.generateInvoice(LANDLORD_ID, input()), 400, 'CONTRACT_REQUIRED');
    expect(mocks.resolveOccupancy).not.toHaveBeenCalled();
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });

  it('hoá đơn đã tồn tại -> 409 INVOICE_EXISTS, không tạo trùng', async () => {
    mocks.invoiceFindUnique.mockResolvedValue({ id: 'invoice-1' });

    await expectAppError(invoiceService.generateInvoice(LANDLORD_ID, input()), 409, 'INVOICE_EXISTS');
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });

  it('P2002 khi ghi (request song song) -> 409 INVOICE_EXISTS thay vì 500', async () => {
    mocks.invoiceCreate.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 'P2002' }));

    await expectAppError(invoiceService.generateInvoice(LANDLORD_ID, input()), 409, 'INVOICE_EXISTS');
  });

  it('phòng của chủ trọ khác -> 403 (không lộ dữ liệu)', async () => {
    mocks.roomFindUnique.mockResolvedValue(roomRow({ property: { landlordId: 'other-landlord' } }));

    await expectAppError(invoiceService.generateInvoice(LANDLORD_ID, input()), 403);
    expect(mocks.contractFindFirst).not.toHaveBeenCalled();
  });
});

describe('invoiceService.previewInvoice', () => {
  it('đủ dữ liệu -> ready=true, công thức và snapshot xem trước khớp lúc phát hành', async () => {
    const preview = await invoiceService.previewInvoice(LANDLORD_ID, input());

    expect(preview.ready).toBe(true);
    expect(preview.blockers).toEqual([]);
    expect(preview.reading).toMatchObject({ electricityConsumption: 12, waterConsumption: 4 });
    expect(preview.occupancy).toEqual({ declarationId: 'declaration-1', occupants: 3, verified: true });
    expect(preview.unitPrices).toEqual({ electricity: '3500.55', water: '15000.00' });
    expect(preview.fees).toEqual({
      roomFee: '3000000.00',
      electricityFee: '42006.60',
      waterFee: '45000.00',
      internetFee: '0.00',
      serviceFee: '0.00',
      parkingFee: '0.00',
      otherFee: '0.00',
      totalAmount: '3087006.60',
    });
  });

  it('thiếu xác minh số người -> dùng mặc định 1 người, ready=true', async () => {
    mocks.resolveOccupancy.mockResolvedValue(null);

    const preview = await invoiceService.previewInvoice(LANDLORD_ID, input());

    expect(preview.ready).toBe(true);
    expect(preview.blockers).toEqual([]);
    expect(preview.occupancy).toEqual({ declarationId: null, occupants: 1, verified: false });
    expect(preview.fees).toMatchObject({ waterFee: '15000.00' });
  });

  it('preview không ghi gì', async () => {
    await invoiceService.previewInvoice(LANDLORD_ID, input());

    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
    expect(mocks.invoiceUpdate).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});

