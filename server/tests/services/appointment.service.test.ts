import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appointmentService } from '../../src/services/appointment.service';

/**
 * ĐẶT LỊCH XEM PHÒNG — Prisma mock.
 *
 * Bất biến:
 *  - phòng (trực tiếp hoặc qua bài đăng) đã thuê/bảo trì ⇒ không tạo lịch mới;
 *  - phòng còn trống ⇒ vẫn đặt được như trước (không chặn quá mức).
 */
const mocks = vi.hoisted(() => ({
  postFindUnique: vi.fn(),
  roomFindUnique: vi.fn(),
  appointmentCreate: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../src/config/db', () => ({
  default: {
    post: { findUnique: mocks.postFindUnique },
    room: { findUnique: mocks.roomFindUnique },
    appointment: { create: mocks.appointmentCreate },
  },
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { createNotification: mocks.notify },
}));

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const futureTime = () => new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

const postRow = (roomStatus: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE', activeContracts: { id: string }[] = []) => ({
  id: 'post-1',
  status: 'APPROVED',
  postType: 'RENT_OUT',
  expiredAt: null,
  roomId: ROOM_ID,
  authorId: 'landlord-1',
  property: { landlordId: 'landlord-1' },
  room: { id: ROOM_ID, status: roomStatus, contracts: activeContracts },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.postFindUnique.mockResolvedValue(postRow('AVAILABLE'));
  mocks.roomFindUnique.mockResolvedValue({
    id: ROOM_ID,
    roomNumber: 'P.101',
    status: 'AVAILABLE',
    contracts: [],
    property: { landlordId: 'landlord-1' },
  });
  mocks.appointmentCreate.mockResolvedValue({ id: 'appointment-1', status: 'PENDING' });
  mocks.notify.mockResolvedValue({ id: 'notification-1' });
});

describe('appointmentService.createAppointment — phòng đã thuê', () => {
  it('bài đăng trỏ tới phòng đã thuê -> 400, không tạo lịch', async () => {
    mocks.postFindUnique.mockResolvedValue(postRow('RENTED'));

    await expect(
      appointmentService.createAppointment('tenant-1', {
        postId: 'post-1',
        appointmentTime: futureTime(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.appointmentCreate).not.toHaveBeenCalled();
  });

  it('bài đăng trỏ tới phòng đang bảo trì -> 400', async () => {
    mocks.postFindUnique.mockResolvedValue(postRow('MAINTENANCE'));

    await expect(
      appointmentService.createAppointment('tenant-1', {
        postId: 'post-1',
        appointmentTime: futureTime(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.appointmentCreate).not.toHaveBeenCalled();
  });

  it('đặt trực tiếp theo roomId của phòng đã thuê -> 400', async () => {
    mocks.roomFindUnique.mockResolvedValue({
      id: ROOM_ID,
      roomNumber: 'P.101',
      status: 'RENTED',
      property: { landlordId: 'landlord-1' },
    });

    await expect(
      appointmentService.createAppointment('tenant-1', {
        roomId: ROOM_ID,
        appointmentTime: futureTime(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.appointmentCreate).not.toHaveBeenCalled();
  });

  it('phòng còn ghi AVAILABLE nhưng đã có hợp đồng ACTIVE -> 400 (dữ liệu cũ)', async () => {
    mocks.postFindUnique.mockResolvedValue(postRow('AVAILABLE', [{ id: 'contract-1' }]));

    await expect(
      appointmentService.createAppointment('tenant-1', {
        postId: 'post-1',
        appointmentTime: futureTime(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.appointmentCreate).not.toHaveBeenCalled();
  });

  it('phòng còn trống -> vẫn tạo lịch PENDING và báo chủ trọ', async () => {
    const appointment = await appointmentService.createAppointment('tenant-1', {
      postId: 'post-1',
      appointmentTime: futureTime(),
    });

    expect(appointment).toMatchObject({ id: 'appointment-1', status: 'PENDING' });
    expect(mocks.appointmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          landlordId: 'landlord-1',
          roomId: ROOM_ID,
          postId: 'post-1',
          status: 'PENDING',
        }),
      }),
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      'landlord-1',
      'Lịch hẹn mới',
      expect.any(String),
      'APPOINTMENT',
      'appointment-1',
    );
  });
});
