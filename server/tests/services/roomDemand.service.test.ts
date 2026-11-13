import { beforeEach, describe, expect, it, vi } from 'vitest';
import { roomDemandService } from '../../src/services/roomDemand.service';

/**
 * DỌN NHU CẦU KHI PHÒNG ĐÃ THUÊ — Prisma mock (không cần DB thật).
 *
 * Bất biến được kiểm tra:
 *  - chỉ huỷ yêu cầu `SUBMITTED`/`CONTRACT_READY` và lịch `PENDING`/`CONFIRMED`;
 *  - yêu cầu vừa được duyệt không bị huỷ (exclude theo id);
 *  - lịch xem khớp theo `roomId` HOẶC bài đăng của phòng (`post.roomId`);
 *  - lệnh update giữ điều kiện trạng thái ⇒ không ghi đè lịch sử;
 *  - thông báo có `dedupeKey` riêng và lỗi thông báo không ném ra ngoài.
 */
const mocks = vi.hoisted(() => ({
  requestFindMany: vi.fn(),
  requestUpdateMany: vi.fn(),
  appointmentFindMany: vi.fn(),
  appointmentUpdateMany: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { createNotification: mocks.notify },
}));

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const ROOM_LABEL = 'P.101';

const tx = () => ({
  rentalRequest: { findMany: mocks.requestFindMany, updateMany: mocks.requestUpdateMany },
  appointment: { findMany: mocks.appointmentFindMany, updateMany: mocks.appointmentUpdateMany },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requestFindMany.mockResolvedValue([]);
  mocks.appointmentFindMany.mockResolvedValue([]);
  mocks.requestUpdateMany.mockResolvedValue({ count: 0 });
  mocks.appointmentUpdateMany.mockResolvedValue({ count: 0 });
  mocks.notify.mockResolvedValue({ id: 'notification-1' });
});

describe('roomDemandService.cancelOpenDemand', () => {
  it('huỷ yêu cầu thuê khác và lịch xem còn hiệu lực của đúng phòng', async () => {
    const appointmentTime = new Date('2026-11-20T02:00:00Z');
    mocks.requestFindMany.mockResolvedValue([{ id: 'request-2', tenantId: 'tenant-2' }]);
    mocks.appointmentFindMany.mockResolvedValue([
      { id: 'appointment-1', tenantId: 'tenant-3', appointmentTime },
    ]);
    mocks.requestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.appointmentUpdateMany.mockResolvedValue({ count: 1 });

    const result = await roomDemandService.cancelOpenDemand(tx() as never, {
      roomId: ROOM_ID,
      excludeRentalRequestId: 'request-1',
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
    expect(mocks.appointmentFindMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [{ roomId: ROOM_ID }, { post: { roomId: ROOM_ID } }],
      },
      select: { id: true, tenantId: true, appointmentTime: true },
    });
    expect(mocks.appointmentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['appointment-1'] },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      data: { status: 'CANCELLED' },
    });
    expect(result).toEqual({
      rentalRequests: [{ id: 'request-2', tenantId: 'tenant-2' }],
      appointments: [{ id: 'appointment-1', tenantId: 'tenant-3', appointmentTime }],
    });
  });

  it('không có nhu cầu nào đang mở -> không UPDATE (không tạo lịch sử rác)', async () => {
    const result = await roomDemandService.cancelOpenDemand(tx() as never, { roomId: ROOM_ID });

    expect(mocks.requestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roomId: ROOM_ID, status: { in: ['SUBMITTED', 'CONTRACT_READY'] } } }),
    );
    expect(mocks.requestUpdateMany).not.toHaveBeenCalled();
    expect(mocks.appointmentUpdateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ rentalRequests: [], appointments: [] });
  });
});

describe('roomDemandService.notifyCancelledDemand', () => {
  it('báo cho từng tenant với dedupeKey theo bản ghi và nhãn phòng', async () => {
    await roomDemandService.notifyCancelledDemand(
      {
        rentalRequests: [{ id: 'request-2', tenantId: 'tenant-2' }],
        appointments: [
          { id: 'appointment-1', tenantId: 'tenant-3', appointmentTime: new Date('2026-11-20T02:00:00Z') },
        ],
      },
      ROOM_LABEL,
    );

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
  });

  it('lỗi thông báo không được ném ra sau khi transaction đã commit', async () => {
    mocks.notify.mockRejectedValue(new Error('socket down'));

    await expect(
      roomDemandService.notifyCancelledDemand(
        { rentalRequests: [{ id: 'request-2', tenantId: 'tenant-2' }], appointments: [] },
        ROOM_LABEL,
      ),
    ).resolves.toBeUndefined();
  });

  it('không có ai bị huỷ -> không gọi thông báo', async () => {
    await roomDemandService.notifyCancelledDemand(
      { rentalRequests: [], appointments: [] },
      ROOM_LABEL,
    );

    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
