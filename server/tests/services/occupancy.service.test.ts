import { beforeEach, describe, expect, it, vi } from 'vitest';
import { occupancyService } from '../../src/services/occupancy.service';

/**
 * OCCUPANCY — Prisma mock toàn bộ (không cần DB thật).
 *
 * Bất biến được kiểm tra:
 *  - chỉ tenant có hợp đồng ACTIVE mới khai được;
 *  - không vượt sức chứa phòng;
 *  - thay đổi ⇒ row mới PENDING + row cũ SUPERSEDED (buộc xác minh lại);
 *  - chỉ chủ trọ sở hữu phòng xác minh/từ chối được (ownership nằm trong WHERE);
 *  - quyết định là lệnh có điều kiện ⇒ thua cuộc đua trả 409;
 *  - số người dùng để tính tiền chỉ đến từ bản đã VERIFIED.
 */
const mocks = vi.hoisted(() => {
  const tx = {
    roomOccupancyDeclaration: { updateMany: vi.fn(), create: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(),
    roomFindUnique: vi.fn(),
    contractFindFirst: vi.fn(),
    declarationFindFirst: vi.fn(),
    declarationFindMany: vi.fn(),
    declarationUpdateMany: vi.fn(),
    declarationFindUniqueOrThrow: vi.fn(),
    notify: vi.fn(),
  };
});

vi.mock('../../src/config/db', () => ({
  default: {
    $transaction: mocks.transaction,
    room: { findUnique: mocks.roomFindUnique },
    contract: { findFirst: mocks.contractFindFirst },
    roomOccupancyDeclaration: {
      findFirst: mocks.declarationFindFirst,
      findMany: mocks.declarationFindMany,
      updateMany: mocks.declarationUpdateMany,
      findUniqueOrThrow: mocks.declarationFindUniqueOrThrow,
    },
  },
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { createNotification: mocks.notify },
}));

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const LANDLORD_ID = '33333333-3333-4333-8333-333333333333';

const roomRow = (overrides: Record<string, unknown> = {}) => ({
  id: ROOM_ID,
  roomNumber: 'P101',
  maxOccupants: 3,
  property: { landlordId: LANDLORD_ID, name: 'Nhà trọ A' },
  ...overrides,
});

const declarationRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'declaration-1',
  roomId: ROOM_ID,
  tenantId: TENANT_ID,
  contractId: 'contract-1',
  occupants: 2,
  status: 'PENDING',
  declaredById: TENANT_ID,
  declaredAt: new Date('2026-11-01T00:00:00Z'),
  verifiedById: null,
  verifiedAt: null,
  rejectionReason: null,
  supersededAt: null,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  room: { id: ROOM_ID, roomNumber: 'P101', maxOccupants: 3, property: { name: 'Nhà trọ A', landlordId: LANDLORD_ID } },
  tenant: { id: TENANT_ID, fullName: 'Nguyễn Văn A', phone: null, email: 'a@example.com' },
  ...overrides,
});

const expectAppError = async (promise: Promise<unknown>, statusCode: number, code?: string) => {
  const matcher: Record<string, unknown> = { statusCode };
  if (code) matcher.code = code;
  await expect(promise).rejects.toMatchObject(matcher);
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.roomFindUnique.mockResolvedValue(roomRow());
  mocks.contractFindFirst.mockResolvedValue({ id: 'contract-1' });
  mocks.declarationFindFirst.mockResolvedValue(null);
  mocks.declarationFindMany.mockResolvedValue([]);
  mocks.notify.mockResolvedValue({ id: 'notification-1' });
  mocks.transaction.mockImplementation(async (arg: unknown) =>
    (arg as (tx: unknown) => unknown)(mocks.tx),
  );
  mocks.tx.roomOccupancyDeclaration.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.roomOccupancyDeclaration.create.mockResolvedValue(declarationRow());
});

describe('occupancyService.declare', () => {
  it('không có hợp đồng ACTIVE -> 403 NO_ACTIVE_RENTAL và không ghi', async () => {
    mocks.contractFindFirst.mockResolvedValue(null);

    await expectAppError(
      occupancyService.declare(TENANT_ID, { roomId: ROOM_ID, occupants: 2 }),
      403,
      'NO_ACTIVE_RENTAL',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('vượt sức chứa phòng -> 400 OCCUPANCY_EXCEEDS_CAPACITY', async () => {
    await expectAppError(
      occupancyService.declare(TENANT_ID, { roomId: ROOM_ID, occupants: 4 }),
      400,
      'OCCUPANCY_EXCEEDS_CAPACITY',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('số người 0 hoặc thập phân -> 400 OCCUPANTS_INVALID', async () => {
    await expectAppError(
      occupancyService.declare(TENANT_ID, { roomId: ROOM_ID, occupants: 0 }),
      400,
      'OCCUPANTS_INVALID',
    );
    await expectAppError(
      occupancyService.declare(TENANT_ID, { roomId: ROOM_ID, occupants: 1.5 }),
      400,
      'OCCUPANTS_INVALID',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('khai lại ĐÚNG số người hiện tại -> no-op, không tạo lịch sử rác', async () => {
    mocks.declarationFindFirst.mockResolvedValue(declarationRow({ occupants: 2 }));

    const result = await occupancyService.declare(TENANT_ID, { roomId: ROOM_ID, occupants: 2 });

    expect(result.id).toBe('declaration-1');
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('đổi số người -> row cũ SUPERSEDED + row mới PENDING, báo chủ trọ', async () => {
    mocks.declarationFindFirst.mockResolvedValue(declarationRow({ occupants: 2 }));

    await occupancyService.declare(TENANT_ID, { roomId: ROOM_ID, occupants: 3 });

    expect(mocks.tx.roomOccupancyDeclaration.updateMany).toHaveBeenCalledWith({
      where: {
        roomId: ROOM_ID,
        tenantId: TENANT_ID,
        status: { in: ['PENDING', 'VERIFIED'] },
        supersededAt: null,
      },
      data: { status: 'SUPERSEDED', supersededAt: expect.any(Date) },
    });
    expect(mocks.tx.roomOccupancyDeclaration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roomId: ROOM_ID,
          tenantId: TENANT_ID,
          contractId: 'contract-1',
          occupants: 3,
          status: 'PENDING',
          declaredById: TENANT_ID,
        }),
      }),
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      LANDLORD_ID,
      expect.any(String),
      expect.stringContaining('3 người'),
      'OCCUPANCY',
      'declaration-1',
      'occupancy:declaration-1:pending',
    );
  });

  it('hai request khai song song -> partial unique index thắng, request thua nhận 409', async () => {
    mocks.transaction.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 'P2002' }));

    await expectAppError(
      occupancyService.declare(TENANT_ID, { roomId: ROOM_ID, occupants: 2 }),
      409,
      'OCCUPANCY_CONCURRENT',
    );
  });

  it('phòng không tồn tại -> 404', async () => {
    mocks.roomFindUnique.mockResolvedValue(null);

    await expect(occupancyService.declare(TENANT_ID, { roomId: ROOM_ID, occupants: 1 })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});


describe('occupancyService.verify', () => {
  it('ownership nằm trong WHERE: không sở hữu phòng -> 404, không update', async () => {
    mocks.declarationFindFirst.mockResolvedValue(null);

    await expect(occupancyService.verify(LANDLORD_ID, 'declaration-1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mocks.declarationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'declaration-1', room: { property: { landlordId: LANDLORD_ID } } },
      }),
    );
    expect(mocks.declarationUpdateMany).not.toHaveBeenCalled();
  });

  it('PENDING -> VERIFIED bằng lệnh có điều kiện + báo tenant', async () => {
    mocks.declarationFindFirst.mockResolvedValue(declarationRow({ status: 'PENDING' }));
    mocks.declarationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.declarationFindUniqueOrThrow.mockResolvedValue(declarationRow({ status: 'VERIFIED' }));

    const result = await occupancyService.verify(LANDLORD_ID, 'declaration-1');

    expect(mocks.declarationUpdateMany).toHaveBeenCalledWith({
      where: { id: 'declaration-1', status: 'PENDING', supersededAt: null },
      data: {
        status: 'VERIFIED',
        verifiedById: LANDLORD_ID,
        verifiedAt: expect.any(Date),
        rejectionReason: null,
      },
    });
    expect(result.status).toBe('VERIFIED');
    expect(mocks.notify).toHaveBeenCalledWith(
      TENANT_ID,
      expect.any(String),
      expect.any(String),
      'OCCUPANCY',
      'declaration-1',
      'occupancy:declaration-1:verified',
    );
  });

  it('hai người xác minh đồng thời -> người sau nhận 409 (count = 0)', async () => {
    mocks.declarationFindFirst.mockResolvedValue(declarationRow({ status: 'PENDING' }));
    mocks.declarationUpdateMany.mockResolvedValue({ count: 0 });

    await expectAppError(
      occupancyService.verify(LANDLORD_ID, 'declaration-1'),
      409,
      'DECLARATION_ALREADY_DECIDED',
    );
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('khai báo đã bị thay thế -> 409, không xác minh nhầm bản cũ', async () => {
    mocks.declarationFindFirst.mockResolvedValue(
      declarationRow({ status: 'SUPERSEDED', supersededAt: new Date() }),
    );

    await expectAppError(
      occupancyService.verify(LANDLORD_ID, 'declaration-1'),
      409,
      'DECLARATION_ALREADY_DECIDED',
    );
    expect(mocks.declarationUpdateMany).not.toHaveBeenCalled();
  });
});

describe('occupancyService.reject', () => {
  it('thiếu lý do -> 400 REJECTION_REASON_REQUIRED, không ghi', async () => {
    await expectAppError(
      occupancyService.reject(LANDLORD_ID, 'declaration-1', '   '),
      400,
      'REJECTION_REASON_REQUIRED',
    );
    expect(mocks.declarationFindFirst).not.toHaveBeenCalled();
    expect(mocks.declarationUpdateMany).not.toHaveBeenCalled();
  });

  it('lưu lý do + trạng thái REJECTED, báo tenant kèm lý do', async () => {
    mocks.declarationFindFirst.mockResolvedValue(declarationRow({ status: 'PENDING' }));
    mocks.declarationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.declarationFindUniqueOrThrow.mockResolvedValue(
      declarationRow({ status: 'REJECTED', rejectionReason: 'Sai số người thực tế' }),
    );

    await occupancyService.reject(LANDLORD_ID, 'declaration-1', ' Sai số người thực tế ');

    expect(mocks.declarationUpdateMany).toHaveBeenCalledWith({
      where: { id: 'declaration-1', status: 'PENDING', supersededAt: null },
      data: {
        status: 'REJECTED',
        rejectionReason: 'Sai số người thực tế',
        verifiedById: LANDLORD_ID,
        verifiedAt: expect.any(Date),
      },
    });
    expect(mocks.notify).toHaveBeenCalledWith(
      TENANT_ID,
      expect.any(String),
      expect.stringContaining('Sai số người thực tế'),
      'OCCUPANCY',
      'declaration-1',
      'occupancy:declaration-1:rejected',
    );
  });
});


describe('occupancyService.resolveVerifiedOccupancy', () => {
  it('PENDING/REJECTED không bao giờ được dùng (WHERE chỉ VERIFIED/SUPERSEDED)', async () => {
    mocks.declarationFindMany.mockResolvedValue([]);

    const result = await occupancyService.resolveVerifiedOccupancy({
      roomId: ROOM_ID,
      tenantId: TENANT_ID,
      month: 11,
      year: 2026,
    });

    expect(result).toBeNull();
    expect(mocks.declarationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roomId: ROOM_ID,
          tenantId: TENANT_ID,
          status: { in: ['VERIFIED', 'SUPERSEDED'] },
          verifiedAt: { not: null, lte: new Date(2026, 11, 0, 23, 59, 59, 999) },
        }),
      }),
    );
  });

  it('bản đã VERIFIED còn hiệu lực được dùng, kèm id để lưu snapshot', async () => {
    mocks.declarationFindMany.mockResolvedValue([
      {
        id: 'd-2',
        occupants: 3,
        status: 'VERIFIED',
        verifiedAt: new Date('2026-11-02T00:00:00Z'),
        supersededAt: null,
      },
    ]);

    const result = await occupancyService.resolveVerifiedOccupancy({
      roomId: ROOM_ID,
      tenantId: TENANT_ID,
      month: 11,
      year: 2026,
    });

    expect(result).toEqual({
      declarationId: 'd-2',
      occupants: 3,
      verifiedAt: new Date('2026-11-02T00:00:00Z'),
    });
  });

  it('bản bị thay thế SAU cuối kỳ vẫn đúng cho kỳ đó', async () => {
    mocks.declarationFindMany.mockResolvedValue([
      {
        id: 'd-old',
        occupants: 2,
        status: 'SUPERSEDED',
        verifiedAt: new Date('2026-10-01T00:00:00Z'),
        supersededAt: new Date('2026-12-05T00:00:00Z'),
      },
    ]);

    const result = await occupancyService.resolveVerifiedOccupancy({
      roomId: ROOM_ID,
      tenantId: TENANT_ID,
      month: 11,
      year: 2026,
    });

    expect(result?.occupants).toBe(2);
  });

  it('bản bị thay thế TRƯỚC cuối kỳ không còn áp dụng', async () => {
    mocks.declarationFindMany.mockResolvedValue([
      {
        id: 'd-old',
        occupants: 2,
        status: 'SUPERSEDED',
        verifiedAt: new Date('2026-10-01T00:00:00Z'),
        supersededAt: new Date('2026-11-05T00:00:00Z'),
      },
    ]);

    const result = await occupancyService.resolveVerifiedOccupancy({
      roomId: ROOM_ID,
      tenantId: TENANT_ID,
      month: 11,
      year: 2026,
    });

    expect(result).toBeNull();
  });
});

describe('occupancyService.getRoomOccupancy', () => {
  it('tenant không có hợp đồng cho phòng -> 403', async () => {
    mocks.contractFindFirst.mockResolvedValue(null);

    await expectAppError(
      occupancyService.getRoomOccupancy({ userId: TENANT_ID, role: 'TENANT' }, ROOM_ID),
      403,
    );
    expect(mocks.declarationFindMany).not.toHaveBeenCalled();
  });

  it('tenant có hợp đồng chỉ thấy lịch sử của chính mình', async () => {
    mocks.contractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mocks.declarationFindMany.mockResolvedValue([]);

    await occupancyService.getRoomOccupancy({ userId: TENANT_ID, role: 'TENANT' }, ROOM_ID);

    expect(mocks.declarationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roomId: ROOM_ID, tenantId: TENANT_ID } }),
    );
  });
});

