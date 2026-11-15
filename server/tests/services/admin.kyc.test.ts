import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminService } from '../../src/services/admin.service';

/**
 * Duyệt KYC phải đảm bảo: ảnh Cloudinary bị xoá TRƯỚC khi DB NULL hoá ref.
 * Nếu xoá lỗi, ref còn lại để script purge retry, không tạo orphan.
 */
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  updateMany: vi.fn(),
  deleteImage: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock('../../src/config/db', () => ({
  default: {
    kycSubmission: {
      findUnique: mocks.findUnique,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock('../../src/services/storage.service', () => ({
  storageService: { deleteImage: mocks.deleteImage },
}));

vi.mock('../../src/services/audit.service', () => ({
  auditService: { record: mocks.recordAudit },
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: {
    notifyUsers: vi.fn(),
    notifyUser: vi.fn(),
  },
}));

vi.mock('../../src/socket/sessionInvalidation', () => ({
  invalidateUserSockets: vi.fn(),
}));

const PENDING_WITH_IMAGES = {
  id: 'kyc-1',
  userId: 'user-1',
  status: 'PENDING',
  frontIdUrl: 'rental-management/kyc/front',
  backIdUrl: 'rental-management/kyc/back',
};

const APPROVED_WITH_IMAGES = { ...PENDING_WITH_IMAGES, status: 'APPROVED' };
const APPROVED_WITHOUT_IMAGES = {
  ...APPROVED_WITH_IMAGES,
  frontIdUrl: null,
  backIdUrl: null,
};

describe('adminService.updateKyc — xoá ảnh khi duyệt', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findUnique.mockResolvedValue(PENDING_WITH_IMAGES);
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    mocks.findUniqueOrThrow
      .mockResolvedValueOnce(APPROVED_WITH_IMAGES)
      .mockResolvedValueOnce(APPROVED_WITHOUT_IMAGES);
    mocks.deleteImage.mockResolvedValue(undefined);
    mocks.recordAudit.mockResolvedValue(undefined);
  });

  it('xoá cả hai ảnh rồi mới NULL hoá cột và trả hồ sơ đã sạch ảnh', async () => {
    const result = await adminService.updateKyc('admin-1', 'kyc-1', 'APPROVED');

    expect(mocks.deleteImage).toHaveBeenCalledWith('rental-management/kyc/front', 'authenticated');
    expect(mocks.deleteImage).toHaveBeenCalledWith('rental-management/kyc/back', 'authenticated');
    expect(mocks.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'kyc-1', status: 'APPROVED' },
      data: { frontIdUrl: null, backIdUrl: null },
    });
    expect(result).toMatchObject({ status: 'APPROVED', frontIdUrl: null, backIdUrl: null });
  });

  it('giữ ref khi Cloudinary lỗi để script purge có thể retry', async () => {
    mocks.deleteImage.mockRejectedValue(new Error('cloudinary down'));

    const result = await adminService.updateKyc('admin-1', 'kyc-1', 'APPROVED');

    // Lần updateMany duy nhất là chốt APPROVED; KHÔNG có update NULL hoá.
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: 'APPROVED',
      frontIdUrl: 'rental-management/kyc/front',
      backIdUrl: 'rental-management/kyc/back',
    });
  });

  it('không cho duyệt lại hồ sơ đã xử lý', async () => {
    mocks.findUnique.mockResolvedValue({ ...PENDING_WITH_IMAGES, status: 'APPROVED' });

    await expect(adminService.updateKyc('admin-1', 'kyc-1', 'APPROVED')).rejects.toMatchObject({
      statusCode: 409,
      code: 'KYC_ALREADY_REVIEWED',
    });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.deleteImage).not.toHaveBeenCalled();
  });

  it('trả 409 khi admin khác đã chốt trước', async () => {
    mocks.updateMany.mockReset();
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(adminService.updateKyc('admin-1', 'kyc-1', 'APPROVED')).rejects.toMatchObject({
      statusCode: 409,
      code: 'KYC_ALREADY_REVIEWED',
    });
    expect(mocks.deleteImage).not.toHaveBeenCalled();
  });
});
