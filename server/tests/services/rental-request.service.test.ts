import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rentalRequestService } from '../../src/services/rental-request.service';

/**
 * DUYỆT YÊU CẦU THUÊ PHÒNG — Prisma mock.
 *
 * Bất biến:
 *  - duyệt thành công ⇒ phòng RENTED, tin đăng đóng, yêu cầu khác CANCELLED,
 *    lịch xem còn hiệu lực CANCELLED — tất cả trong CÙNG transaction;
 *  - yêu cầu vừa duyệt không bị huỷ;
 *  - tenant tự huỷ không đụng tới lịch xem / yêu cầu khác.
 */
const mocks = vi.hoisted(() => ({
  requestFindUnique: vi.fn(),
  requestUpdate: vi.fn(),
  requestFindMany: vi.fn(),
  requestUpdateMany: vi.fn(),
  roomUpdateMany: vi.fn(),
  postUpdateMany: vi.fn(),
  appointmentFindMany: vi.fn(),
  appointmentUpdateMany: vi.fn(),
  transaction: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../src/config/db', () => ({
  default: {
    $transaction: mocks.transaction,
    rentalRequest: {
      findUnique: mocks.requestFindUnique,
      findFirst: vi.fn(),
      create: vi.fn(),
      update: mocks.requestUpdate,
    },
  },
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { createNotification: mocks.notify },
}));

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const ROOM_LABEL = 'P.101';

const pendingRequest = (overrides: Record<string, unknown> = {}) => ({
  id: 'request-1',
  tenantId: 'tenant-1',
  landlordId: 'landlord-1',
  roomId: ROOM_ID,
  status: 'SUBMITTED',
  room: { roomNumber: ROOM_LABEL },
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requestFindUnique.mockResolvedValue(pendingRequest());
  mocks.roomUpdateMany.mockResolvedValue({ count: 1 });
  mocks.postUpdateMany.mockResolvedValue({ count: 1 });
  mocks.requestUpdate.mockResolvedValue(pendingRequest({ status: 'APPROVED' }));
  mocks.requestFindMany.mockResolvedValue([{ id: 'request-2', tenantId: 'tenant-2' }]);
  mocks.appointmentFindMany.mockResolvedValue([
    { id: 'appointment-1', tenantId: 'tenant-3', appointmentTime: new Date('2026-11-20T02:00:00Z') },
  ]);
  mocks.requestUpdateMany.mockResolvedValue({ count: 1 });
  mocks.appointmentUpdateMany.mockResolvedValue({ count: 1 });
  mocks.notify.mockResolvedValue({ id: 'notification-1' });
  mocks.transaction.mockImplementation(async (arg: unknown) =>
    (arg as (tx: unknown) => unknown)({
      room: { updateMany: mocks.roomUpdateMany },
      post: { updateMany: mocks.postUpdateMany },
      rentalRequest: {
        update: mocks.requestUpdate,
        findMany: mocks.requestFindMany,
        updateMany: mocks.requestUpdateMany,
      },
      appointment: {
        findMany: mocks.appointmentFindMany,
        updateMany: mocks.appointmentUpdateMany,
      },
    }),
  );
});

describe('rentalRequestService.updateStatus — chủ trọ duyệt', () => {
  it('huỷ yêu cầu thuê khác và mọi lịch xem còn hiệu lực của phòng', async () => {
    const approved = await rentalRequestService.updateStatus('landlord-1', 'LANDLORD', 'request-1', 'APPROVED');

    expect(approved).toMatchObject({ id: 'request-1', status: 'APPROVED' });
    expect(mocks.roomUpdateMany).toHaveBeenCalledWith({
      where: { id: ROOM_ID, status: 'AVAILABLE' },
      data: { status: 'RENTED' },
    });
    expect(mocks.postUpdateMany).toHaveBeenCalledWith({
      where: { roomId: ROOM_ID, status: { in: ['PENDING', 'APPROVED'] } },
      data: { status: 'CLOSED' },
    });
    expect(mocks.requestFindMany).toHaveBeenCalledWith({
      where: {
        roomId: ROOM_ID,
        status: { in: ['SUBMITTED', 'CONTRACT_READY'] },
        id: { not: 'request-1' },
      },
      select: { id: true, tenantId: true },
    });
    expect(mocks.requestUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['request-2'] },
        status: { in: ['SUBMITTED', 'CONTRACT_READY'] },
      },
      data: { status: 'CANCELLED' },
    });
    expect(mocks.appointmentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['appointment-1'] },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      data: { status: 'CANCELLED' },
    });
    expect(mocks.notify).toHaveBeenCalledWith(
      'tenant-2',
      'Yêu cầu thuê phòng đã bị huỷ',
      expect.stringContaining(ROOM_LABEL),
      'SYSTEM',
      'request-2',
      'room-rented:rental-request:request-2',
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      'tenant-3',
      'Lịch xem phòng đã bị huỷ',
      expect.stringContaining(ROOM_LABEL),
      'APPOINTMENT',
      'appointment-1',
      'room-rented:appointment:appointment-1',
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      'tenant-1',
      'Yêu cầu thuê phòng được chấp thuận',
      expect.any(String),
      'SYSTEM',
      'request-1',
    );
  });

  it('phòng đã bị giữ bởi yêu cầu khác -> 409 và không huỷ gì', async () => {
    mocks.roomUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      rentalRequestService.updateStatus('landlord-1', 'LANDLORD', 'request-1', 'APPROVED'),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mocks.requestUpdateMany).not.toHaveBeenCalled();
    expect(mocks.appointmentUpdateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});

describe('rentalRequestService.updateStatus — tenant tự huỷ', () => {
  it('chỉ đổi yêu cầu của mình, không đụng lịch xem hay yêu cầu khác', async () => {
    mocks.requestUpdate.mockResolvedValue(pendingRequest({ status: 'CANCELLED' }));

    const cancelled = await rentalRequestService.updateStatus('tenant-1', 'TENANT', 'request-1', 'CANCELLED');

    expect(cancelled).toMatchObject({ status: 'CANCELLED' });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.requestUpdateMany).not.toHaveBeenCalled();
    expect(mocks.appointmentUpdateMany).not.toHaveBeenCalled();
  });

  it('tenant huỷ yêu cầu của người khác -> 403', async () => {
    await expect(
      rentalRequestService.updateStatus('tenant-9', 'TENANT', 'request-1', 'CANCELLED'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
