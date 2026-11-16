import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rentalRequestService } from '../../src/services/rental-request.service';

/**
 * Cổng KYC của khách thuê — server phải chặn TRƯỚC khi đọc/giữ phòng.
 * Client có hiển thị cảnh báo hay không không quan trọng: request gọi thẳng API
 * vẫn phải bị từ chối với mã máy đọc được.
 */
const mocks = vi.hoisted(() => ({
  loadKycState: vi.fn(),
  roomFindFirst: vi.fn(),
  requestFindFirst: vi.fn(),
  requestCreate: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../../src/config/db', () => ({
  default: {
    room: { findFirst: mocks.roomFindFirst },
    rentalRequest: {
      findFirst: mocks.requestFindFirst,
      create: mocks.requestCreate,
    },
  },
}));

vi.mock('../../src/services/kycGate.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/kycGate.service')>();
  return { ...actual, loadKycState: mocks.loadKycState };
});

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { createNotification: mocks.notify },
}));

vi.mock('../../src/services/roomDemand.service', () => ({
  roomDemandService: {
    cancelOpenDemand: vi.fn(),
    notifyCancelledDemand: vi.fn(),
  },
}));

const PAYLOAD = {
  roomId: '11111111-1111-4111-8111-111111111111',
  moveInDate: '2027-01-01',
  leaseTermMonths: 12,
};

describe('rentalRequestService.create — cổng KYC', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(['NONE', 'PENDING', 'REJECTED'] as const)(
    'chặn khi KYC là %s và không chạm tới phòng',
    async (state) => {
      mocks.loadKycState.mockResolvedValue(state);

      await expect(rentalRequestService.create('tenant-1', PAYLOAD)).rejects.toMatchObject({
        statusCode: 403,
        code: 'TENANT_KYC_REQUIRED',
      });
      expect(mocks.roomFindFirst).not.toHaveBeenCalled();
      expect(mocks.requestCreate).not.toHaveBeenCalled();
    },
  );

  it('cho phép đi tiếp khi KYC đã APPROVED', async () => {
    mocks.loadKycState.mockResolvedValue('APPROVED');
    mocks.roomFindFirst.mockResolvedValue({
      id: PAYLOAD.roomId,
      status: 'AVAILABLE',
      contracts: [],
      property: { landlordId: 'landlord-1' },
    });
    mocks.requestFindFirst.mockResolvedValue(null);
    mocks.requestCreate.mockResolvedValue({
      id: 'request-1',
      tenantId: 'tenant-1',
      landlordId: 'landlord-1',
      roomId: PAYLOAD.roomId,
      room: { roomNumber: 'P.101' },
    });

    await expect(rentalRequestService.create('tenant-1', PAYLOAD)).resolves.toMatchObject({
      id: 'request-1',
    });
    expect(mocks.roomFindFirst).toHaveBeenCalled();
    expect(mocks.requestCreate).toHaveBeenCalled();
    // Client deep-link dựa vào type riêng; SYSTEM sẽ không biết reference_id là
    // yêu cầu thuê và rơi về trang nội dung thông báo.
    expect(mocks.notify).toHaveBeenCalledWith(
      'landlord-1',
      'Yêu cầu thuê phòng mới',
      expect.stringContaining('P.101'),
      'RENTAL_REQUEST',
      'request-1',
    );
  });
});
