import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maintenanceOfferService } from '../../src/services/maintenanceOffer.service';

/**
 * THƯƠNG LƯỢNG GIÁ (Batch 3) — Prisma mock toàn bộ.
 *
 * Các bất biến được khoá bằng test:
 *  - chỉ chủ trọ / thợ ĐƯỢC GIAO mới đọc và đề xuất được (người ngoài 404);
 *  - đề xuất mới là CAS trên `negotiationVersion` + đánh dấu PENDING cũ SUPERSEDED;
 *  - người đề xuất không thể tự chấp nhận (403), tab cũ (expectedVersion) nhận 409;
 *  - chỉ ACCEPT mới ghi `agreedAmount`; REJECT không làm mất giá đã chốt trước đó;
 *  - thua cuộc đua (count = 0) -> 409 và KHÔNG ghi gì thêm;
 *  - thông báo/audit chỉ phát sau commit.
 */
const mocks = vi.hoisted(() => {
  const events: string[] = [];
  const tx = {
    maintenanceTask: { findUnique: vi.fn(), updateMany: vi.fn() },
    maintenanceTaskOffer: { updateMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  };
  return {
    events,
    tx,
    transaction: vi.fn(),
    taskFindUnique: vi.fn(),
    offerFindMany: vi.fn(),
    notifyUsers: vi.fn(),
    audit: vi.fn(),
  };
});

vi.mock('../../src/config/db', () => ({
  default: {
    $transaction: mocks.transaction,
    maintenanceTask: { findUnique: mocks.taskFindUnique },
    maintenanceTaskOffer: { findMany: mocks.offerFindMany },
  },
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { notifyUsers: mocks.notifyUsers },
}));

vi.mock('../../src/services/audit.service', () => ({
  auditService: { record: mocks.audit },
}));

const TASK_ID = 'task-1';
const LANDLORD_ID = 'landlord-1';
const STAFF_ID = 'staff-1';
const OTHER_STAFF_ID = 'staff-2';
const OFFER_ID = 'offer-1';

const taskRow = (overrides: Record<string, unknown> = {}) => ({
  id: TASK_ID,
  status: 'ASSIGNED',
  landlordId: LANDLORD_ID,
  assignedStaffId: STAFF_ID,
  agreedAmount: null,
  agreedAt: null,
  negotiationVersion: 2,
  title: 'Sửa hệ thống điện',
  ...overrides,
});

const offerRow = (overrides: Record<string, unknown> = {}) => ({
  id: OFFER_ID,
  taskId: TASK_ID,
  version: 3,
  proposedById: LANDLORD_ID,
  proposedByRole: 'LANDLORD',
  amount: '500000.00',
  note: null,
  status: 'PENDING',
  respondedById: null,
  respondedAt: null,
  responseNote: null,
  createdAt: new Date('2026-11-10T00:00:00.000Z'),
  proposedBy: { id: LANDLORD_ID, fullName: 'Chủ trọ A', avatarUrl: null },
  ...overrides,
});

const expectAppError = async (promise: Promise<unknown>, statusCode: number, code: string) => {
  await expect(promise).rejects.toMatchObject({ statusCode, code });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.events.length = 0;

  mocks.transaction.mockImplementation(async (arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    const result = await (arg as (tx: unknown) => unknown)(mocks.tx);
    mocks.events.push('commit');
    return result;
  });

  mocks.notifyUsers.mockImplementation(async () => {
    mocks.events.push('notify');
    return [];
  });
  mocks.audit.mockImplementation(async () => ({ id: 'audit-1' }));

  mocks.taskFindUnique.mockResolvedValue(taskRow());
  mocks.tx.maintenanceTask.findUnique.mockResolvedValue(taskRow());
  mocks.tx.maintenanceTask.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.maintenanceTaskOffer.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.maintenanceTaskOffer.create.mockResolvedValue(
    offerRow({ proposedById: STAFF_ID, proposedByRole: 'STAFF' }),
  );
  mocks.tx.maintenanceTaskOffer.findFirst.mockResolvedValue({
    id: OFFER_ID,
    amount: '500000.00',
    status: 'PENDING',
    proposedById: STAFF_ID,
    version: 3,
  });
  mocks.offerFindMany.mockResolvedValue([offerRow({ proposedById: STAFF_ID, proposedByRole: 'STAFF' })]);
});


describe('maintenanceOfferService.list', () => {
  it('người không tham gia không đọc được lịch sử (404, không lộ công việc)', async () => {
    mocks.taskFindUnique.mockResolvedValue(taskRow({ assignedStaffId: OTHER_STAFF_ID }));

    await expect(maintenanceOfferService.list(STAFF_ID, TASK_ID)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.offerFindMany).not.toHaveBeenCalled();
  });

  it('trả về actorRole + canNegotiate theo trạng thái công việc', async () => {
    const payload = await maintenanceOfferService.list(STAFF_ID, TASK_ID);

    expect(payload).toMatchObject({ taskId: TASK_ID, actorRole: 'STAFF', canNegotiate: true });
  });
});

describe('maintenanceOfferService.propose', () => {
  it('đề xuất mới: CAS version, SUPERSEDED đề xuất cũ, lưu đúng minor units, báo SAU commit', async () => {
    await maintenanceOfferService.propose(STAFF_ID, TASK_ID, { amount: 500000 });

    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: TASK_ID, status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, negotiationVersion: 2 },
      data: { negotiationVersion: { increment: 1 } },
    });
    expect(mocks.tx.maintenanceTaskOffer.updateMany).toHaveBeenCalledWith({
      where: { taskId: TASK_ID, status: 'PENDING' },
      data: { status: 'SUPERSEDED' },
    });
    expect(mocks.tx.maintenanceTaskOffer.create).toHaveBeenCalledWith({
      data: {
        taskId: TASK_ID,
        version: 3,
        proposedById: STAFF_ID,
        proposedByRole: 'STAFF',
        amount: '500000.00',
        note: null,
      },
      select: expect.any(Object),
    });
    expect(mocks.notifyUsers).toHaveBeenCalledWith(
      [LANDLORD_ID],
      expect.objectContaining({ type: 'OFFER', referenceId: TASK_ID }),
      expect.any(Function),
    );
    expect(mocks.events).toEqual(['commit', 'notify']);
  });

  it('công việc đã gửi nghiệm thu -> 409 PRICE_LOCKED, không ghi', async () => {
    mocks.tx.maintenanceTask.findUnique.mockResolvedValue(taskRow({ status: 'SUBMITTED' }));

    await expectAppError(maintenanceOfferService.propose(STAFF_ID, TASK_ID, { amount: 100 }), 409, 'PRICE_LOCKED');
    expect(mocks.tx.maintenanceTask.updateMany).not.toHaveBeenCalled();
    expect(mocks.notifyUsers).not.toHaveBeenCalled();
  });

  it('thua CAS version -> 409 NEGOTIATION_CONFLICT, không tạo đề xuất, không báo', async () => {
    mocks.tx.maintenanceTask.updateMany.mockResolvedValue({ count: 0 });

    await expectAppError(
      maintenanceOfferService.propose(STAFF_ID, TASK_ID, { amount: 100 }),
      409,
      'NEGOTIATION_CONFLICT',
    );
    expect(mocks.tx.maintenanceTaskOffer.create).not.toHaveBeenCalled();
    expect(mocks.notifyUsers).not.toHaveBeenCalled();
    expect(mocks.events).toEqual([]);
  });

  it('giá 0 bị chặn ở tầng validation (không thể "chốt" 0 đồng)', async () => {
    const { maintenanceOfferProposeSchema } = await import('../../src/validations/maintenanceOffer.validation');

    expect(maintenanceOfferProposeSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(maintenanceOfferProposeSchema.safeParse({ amount: 1500.5 }).success).toBe(true);
    expect(maintenanceOfferProposeSchema.safeParse({ amount: '1500.555' }).success).toBe(false);
    expect(maintenanceOfferProposeSchema.safeParse({ amount: '' }).success).toBe(false);
  });
});


describe('maintenanceOfferService.respond — quyết định của bên còn lại', () => {
  it('ACCEPT: ghi agreedAmount + agreedAt + tăng version, báo người đề xuất SAU commit', async () => {
    await maintenanceOfferService.respond(LANDLORD_ID, TASK_ID, OFFER_ID, 'ACCEPT');

    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: TASK_ID, status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, negotiationVersion: 2 },
      data: { agreedAmount: '500000.00', agreedAt: expect.any(Date), negotiationVersion: { increment: 1 } },
    });
    // Đề xuất còn chờ khác không còn ý nghĩa sau khi chốt giá.
    expect(mocks.tx.maintenanceTaskOffer.updateMany).toHaveBeenCalledWith({
      where: { taskId: TASK_ID, status: 'PENDING' },
      data: { status: 'SUPERSEDED' },
    });
    expect(mocks.notifyUsers).toHaveBeenCalledWith(
      [STAFF_ID],
      expect.objectContaining({ type: 'OFFER' }),
      expect.any(Function),
    );
    expect(mocks.events).toEqual(['commit', 'notify']);
  });

  it('REJECT: chỉ tăng version, KHÔNG đụng agreedAmount đã chốt trước đó', async () => {
    mocks.tx.maintenanceTask.findUnique.mockResolvedValue(
      taskRow({ agreedAmount: '300000.00', negotiationVersion: 4 }),
    );
    mocks.tx.maintenanceTaskOffer.findFirst.mockResolvedValue({
      id: OFFER_ID,
      amount: '700000.00',
      status: 'PENDING',
      proposedById: STAFF_ID,
      version: 5,
    });

    await maintenanceOfferService.respond(LANDLORD_ID, TASK_ID, OFFER_ID, 'REJECT');

    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: TASK_ID, status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, negotiationVersion: 4 },
      data: { negotiationVersion: { increment: 1 } },
    });
    expect(mocks.tx.maintenanceTask.updateMany.mock.calls[0][0].data).not.toHaveProperty('agreedAmount');
  });

  it('không thể tự chấp nhận đề xuất của chính mình (403, không ghi)', async () => {
    mocks.tx.maintenanceTaskOffer.findFirst.mockResolvedValue({
      id: OFFER_ID,
      amount: '500000.00',
      status: 'PENDING',
      proposedById: LANDLORD_ID,
      version: 3,
    });

    await expectAppError(
      maintenanceOfferService.respond(LANDLORD_ID, TASK_ID, OFFER_ID, 'ACCEPT'),
      403,
      'OFFER_SELF_RESPONSE',
    );
    expect(mocks.tx.maintenanceTaskOffer.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.maintenanceTask.updateMany).not.toHaveBeenCalled();
  });

  it('tab cũ gửi expectedVersion lệch -> 409 NEGOTIATION_VERSION_CONFLICT', async () => {
    await expectAppError(
      maintenanceOfferService.respond(LANDLORD_ID, TASK_ID, OFFER_ID, 'ACCEPT', { expectedVersion: 1 }),
      409,
      'NEGOTIATION_VERSION_CONFLICT',
    );
    expect(mocks.tx.maintenanceTaskOffer.findFirst).not.toHaveBeenCalled();
  });

  it('đề xuất vừa bị xử lý ở nơi khác (claim count = 0) -> 409 OFFER_STATE_CONFLICT', async () => {
    mocks.tx.maintenanceTaskOffer.updateMany.mockResolvedValue({ count: 0 });

    await expectAppError(
      maintenanceOfferService.respond(LANDLORD_ID, TASK_ID, OFFER_ID, 'ACCEPT'),
      409,
      'OFFER_STATE_CONFLICT',
    );
    expect(mocks.tx.maintenanceTask.updateMany).not.toHaveBeenCalled();
    expect(mocks.notifyUsers).not.toHaveBeenCalled();
  });

  it('đề xuất không còn PENDING -> 409 OFFER_NOT_PENDING', async () => {
    mocks.tx.maintenanceTaskOffer.findFirst.mockResolvedValue({
      id: OFFER_ID,
      amount: '500000.00',
      status: 'SUPERSEDED',
      proposedById: STAFF_ID,
      version: 3,
    });

    await expectAppError(
      maintenanceOfferService.respond(LANDLORD_ID, TASK_ID, OFFER_ID, 'ACCEPT'),
      409,
      'OFFER_NOT_PENDING',
    );
  });
});

describe('maintenanceOfferService.withdraw', () => {
  it('chỉ người đề xuất được rút (403 OFFER_NOT_OWNER)', async () => {
    mocks.tx.maintenanceTaskOffer.findFirst.mockResolvedValue({
      id: OFFER_ID,
      status: 'PENDING',
      proposedById: STAFF_ID,
    });

    await expectAppError(
      maintenanceOfferService.withdraw(LANDLORD_ID, TASK_ID, OFFER_ID),
      403,
      'OFFER_NOT_OWNER',
    );
    expect(mocks.tx.maintenanceTaskOffer.updateMany).not.toHaveBeenCalled();
  });

  it('rút thành công: đánh dấu WITHDRAWN + tăng version (không phát thông báo giá)', async () => {
    mocks.tx.maintenanceTaskOffer.findFirst.mockResolvedValue({
      id: OFFER_ID,
      status: 'PENDING',
      proposedById: STAFF_ID,
    });

    await maintenanceOfferService.withdraw(STAFF_ID, TASK_ID, OFFER_ID);

    expect(mocks.tx.maintenanceTaskOffer.updateMany).toHaveBeenCalledWith({
      where: { id: OFFER_ID, taskId: TASK_ID, status: 'PENDING', proposedById: STAFF_ID },
      data: { status: 'WITHDRAWN', respondedById: STAFF_ID, respondedAt: expect.any(Date) },
    });
    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: TASK_ID, status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, negotiationVersion: 2 },
      data: { negotiationVersion: { increment: 1 } },
    });
  });
});
