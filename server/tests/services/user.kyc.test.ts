import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userService } from '../../src/services/user.service';

/**
 * KYC của người dùng:
 *  - APPROVED là trạng thái CUỐI: không được nộp lại;
 *  - PENDING không được ghi đè hồ sơ admin đang đối soát;
 *  - REJECTED được nộp lại và ảnh cũ được dọn;
 *  - hồ sơ APPROVED không còn ảnh nên `getMyKyc` trả NULL, không ký URL.
 */
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  findAdmins: vi.fn(),
  deleteImage: vi.fn(),
  getPrivateImageUrl: vi.fn(),
  notifyUsers: vi.fn(),
}));

vi.mock('../../src/config/db', () => ({
  default: {
    kycSubmission: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
    user: { findMany: mocks.findAdmins },
  },
}));

vi.mock('../../src/services/storage.service', () => ({
  storageService: {
    deleteImage: mocks.deleteImage,
    getPrivateImageUrl: mocks.getPrivateImageUrl,
  },
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { notifyUsers: mocks.notifyUsers },
}));

const DATA = {
  idNumber: '001200001234',
  permanentAddress: '12 Nguyễn Trãi, Hà Nội',
  frontIdUrl: 'rental-management/kyc/front-new',
  backIdUrl: 'rental-management/kyc/back-new',
};

describe('userService.submitKyc — một lần duy nhất', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findAdmins.mockResolvedValue([]);
    mocks.notifyUsers.mockResolvedValue(undefined);
    mocks.deleteImage.mockResolvedValue(undefined);
    mocks.upsert.mockResolvedValue({ id: 'kyc-1', status: 'PENDING' });
  });

  it('chặn nộp lại khi hồ sơ đã APPROVED', async () => {
    mocks.findUnique.mockResolvedValue({ status: 'APPROVED', frontIdUrl: null, backIdUrl: null });

    await expect(userService.submitKyc('user-1', DATA)).rejects.toMatchObject({
      statusCode: 409,
      code: 'KYC_ALREADY_APPROVED',
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('chặn ghi đè khi hồ sơ đang PENDING', async () => {
    mocks.findUnique.mockResolvedValue({ status: 'PENDING', frontIdUrl: 'a', backIdUrl: 'b' });

    await expect(userService.submitKyc('user-1', DATA)).rejects.toMatchObject({
      statusCode: 409,
      code: 'KYC_ALREADY_PENDING',
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('cho nộp lại hồ sơ REJECTED và xoá ảnh cũ sau khi ghi hồ sơ mới', async () => {
    mocks.findUnique.mockResolvedValue({
      status: 'REJECTED',
      frontIdUrl: 'rental-management/kyc/front-old',
      backIdUrl: 'rental-management/kyc/back-old',
    });

    await userService.submitKyc('user-1', DATA);

    expect(mocks.upsert).toHaveBeenCalled();
    expect(mocks.deleteImage).toHaveBeenCalledWith('rental-management/kyc/front-old', 'authenticated');
    expect(mocks.deleteImage).toHaveBeenCalledWith('rental-management/kyc/back-old', 'authenticated');
  });
});

describe('userService.getMyKyc — hồ sơ đã duyệt', () => {
  it('trả NULL cho ảnh đã xoá và không ký URL', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'kyc-1',
      userId: 'user-1',
      idNumber: '001200001234',
      permanentAddress: '12 Nguyễn Trãi, Hà Nội',
      frontIdUrl: null,
      backIdUrl: null,
      status: 'APPROVED',
    });

    await expect(userService.getMyKyc('user-1')).resolves.toMatchObject({
      status: 'APPROVED',
      frontIdUrl: null,
      backIdUrl: null,
    });
    expect(mocks.getPrivateImageUrl).not.toHaveBeenCalled();
  });
});
