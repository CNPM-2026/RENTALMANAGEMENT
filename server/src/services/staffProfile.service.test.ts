import { beforeEach, describe, expect, it, vi } from 'vitest';
import { staffProfileService } from './staffProfile.service';
import type { StaffProfileUpsertInput } from '../validations/staffProfile.validation';

/**
 * Test lớp service của staff marketplace KHÔNG cần DB thật:
 * - ghi hồ sơ + thay kỹ năng phải nằm trong CÙNG một transaction;
 * - mọi truy vấn đọc đều bị giới hạn ở tài khoản role STAFF đang hoạt động
 *   (chống IDOR/dò user khác) và không lộ email/toạ độ trong payload công khai.
 */
const mocks = vi.hoisted(() => {
  const tx = {
    staffProfile: { upsert: vi.fn(), findUniqueOrThrow: vi.fn() },
    staffSkill: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    kycFindUnique: vi.fn(),
  };
});

vi.mock('../config/db', () => ({
  default: {
    $transaction: mocks.transaction,
    kycSubmission: { findUnique: mocks.kycFindUnique },
    staffProfile: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      count: mocks.count,
      update: mocks.update,
    },
  },
}));

const input = (value: Record<string, unknown>) => value as StaffProfileUpsertInput;

describe('staffProfileService.upsertMine', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Hỗ trợ cả hai dạng $transaction: callback (ghi) và mảng (đọc song song).
    mocks.transaction.mockImplementation(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(mocks.tx),
    );
    mocks.tx.staffProfile.upsert.mockResolvedValue({ id: 'profile-1' });
    mocks.tx.staffProfile.findUniqueOrThrow.mockResolvedValue({
      id: 'profile-1',
      isAvailable: true,
      user: { id: 'user-1', kycSubmission: null },
    });
    mocks.tx.staffSkill.deleteMany.mockResolvedValue({ count: 2 });
    mocks.tx.staffSkill.createMany.mockResolvedValue({ count: 1 });
  });

  it('thay thế toàn bộ kỹ năng trong cùng transaction với hồ sơ', async () => {
    const result = await staffProfileService.upsertMine(
      'user-1',
      input({ description: 'Thợ điện 5 năm kinh nghiệm', skills: ['ELECTRICAL'] }),
    );

    expect(result).toMatchObject({ id: 'profile-1', kycStatus: 'NONE' });
    expect(result).not.toHaveProperty('user.kycSubmission');
    expect(mocks.tx.staffProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
    expect(mocks.tx.staffSkill.deleteMany).toHaveBeenCalledWith({ where: { staffProfileId: 'profile-1' } });
    expect(mocks.tx.staffSkill.createMany).toHaveBeenCalledWith({
      data: [{ staffProfileId: 'profile-1', category: 'ELECTRICAL' }],
    });
  });

  it('không chạm bảng kỹ năng khi payload không gửi `skills`', async () => {
    await staffProfileService.upsertMine('user-1', input({ description: 'Thợ điện 5 năm kinh nghiệm' }));

    expect(mocks.tx.staffSkill.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.staffSkill.createMany).not.toHaveBeenCalled();
  });

  it('mảng kỹ năng rỗng xoá hết kỹ năng nhưng không gọi createMany', async () => {
    await staffProfileService.upsertMine('user-1', input({ skills: [] }));

    expect(mocks.tx.staffSkill.deleteMany).toHaveBeenCalledOnce();
    expect(mocks.tx.staffSkill.createMany).not.toHaveBeenCalled();
  });
});

describe('staffProfileService.upsertMine — cổng KYC', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(mocks.tx),
    );
    mocks.tx.staffProfile.upsert.mockResolvedValue({ id: 'profile-1' });
    mocks.tx.staffProfile.findUniqueOrThrow.mockResolvedValue({
      id: 'profile-1',
      user: { id: 'user-1', kycSubmission: { status: 'APPROVED' } },
    });
    mocks.tx.staffSkill.deleteMany.mockResolvedValue({ count: 0 });
    mocks.tx.staffSkill.createMany.mockResolvedValue({ count: 0 });
  });

  it('KHÔNG cho bật `isAvailable` qua hồ sơ khi KYC chưa duyệt (không ghi gì)', async () => {
    mocks.kycFindUnique.mockResolvedValue(null);

    await expect(
      staffProfileService.upsertMine('user-1', input({ description: 'Thợ điện 5 năm kinh nghiệm', isAvailable: true })),
    ).rejects.toMatchObject({ statusCode: 403, code: 'STAFF_KYC_REQUIRED' });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('cho bật `isAvailable` qua hồ sơ khi KYC đã duyệt', async () => {
    mocks.kycFindUnique.mockResolvedValue({ status: 'APPROVED' });

    await expect(
      staffProfileService.upsertMine('user-1', input({ description: 'Thợ điện 5 năm kinh nghiệm', isAvailable: true })),
    ).resolves.toMatchObject({ id: 'profile-1', kycStatus: 'APPROVED' });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it('cập nhật hồ sơ (không kèm isAvailable) không cần KYC', async () => {
    await staffProfileService.upsertMine('user-1', input({ description: 'Thợ điện 5 năm kinh nghiệm' }));

    expect(mocks.kycFindUnique).not.toHaveBeenCalled();
  });
});

describe('staffProfileService.updateAvailability', () => {
  const approvedProfile = (overrides: Record<string, unknown> = {}) => ({
    id: 'profile-1',
    isAvailable: true,
    user: { id: 'user-1', kycSubmission: { status: 'APPROVED' } },
    ...overrides,
  });

  beforeEach(() => vi.resetAllMocks());

  it('404 và không ghi gì khi thợ chưa có hồ sơ', async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(staffProfileService.updateAvailability('user-1', false)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('CHẶN bật nhận việc khi KYC chưa được duyệt (403, mã STAFF_KYC_REQUIRED)', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'profile-1',
      user: { kycSubmission: { status: 'PENDING' } },
    });

    await expect(staffProfileService.updateAvailability('user-1', true)).rejects.toMatchObject({
      statusCode: 403,
      code: 'STAFF_KYC_REQUIRED',
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(['PENDING', 'REJECTED'])('fail closed với trạng thái KYC %s', async (status) => {
    mocks.findUnique.mockResolvedValue({ id: 'profile-1', user: { kycSubmission: { status } } });

    await expect(staffProfileService.updateAvailability('user-1', true)).rejects.toMatchObject({
      code: 'STAFF_KYC_REQUIRED',
    });
  });

  it('fail closed khi chưa từng nộp KYC (không có bản ghi)', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'profile-1', user: { kycSubmission: null } });

    await expect(staffProfileService.updateAvailability('user-1', true)).rejects.toMatchObject({
      code: 'STAFF_KYC_REQUIRED',
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('cho phép TẮT nhận việc dù KYC chưa duyệt', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'profile-1', user: { kycSubmission: { status: 'PENDING' } } });
    mocks.update.mockResolvedValue(approvedProfile({ isAvailable: false }));

    await expect(staffProfileService.updateAvailability('user-1', false)).resolves.toMatchObject({
      isAvailable: false,
      kycStatus: 'APPROVED',
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' }, data: { isAvailable: false } }),
    );
  });

  it('bật nhận việc khi KYC đã duyệt và trả kèm kycStatus', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'profile-1',
      user: { kycSubmission: { status: 'APPROVED' } },
    });
    mocks.update.mockResolvedValue(approvedProfile());

    await expect(staffProfileService.updateAvailability('user-1', true)).resolves.toMatchObject({
      isAvailable: true,
      kycStatus: 'APPROVED',
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' }, data: { isAvailable: true } }),
    );
  });
});

describe('staffProfileService.getMine', () => {
  beforeEach(() => vi.resetAllMocks());

  it('gắn kycStatus phẳng và bỏ quan hệ thô khỏi payload', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'profile-1',
      user: { id: 'user-1', kycSubmission: { status: 'REJECTED' } },
    });

    const result = await staffProfileService.getMine('user-1');

    expect(result).toMatchObject({ id: 'profile-1', kycStatus: 'REJECTED' });
    expect(result).not.toHaveProperty('user.kycSubmission');
  });
});

describe('staffProfileService.getPublicProfile', () => {
  beforeEach(() => vi.resetAllMocks());

  it('chỉ tìm trong tài khoản role STAFF đang hoạt động VÀ đã duyệt KYC (chống dò user khác)', async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(staffProfileService.getPublicProfile('landlord-1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'landlord-1',
          user: { role: 'STAFF', isActive: true, kycSubmission: { is: { status: 'APPROVED' } } },
        },
      }),
    );
  });
});

describe('staffProfileService.browse', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(mocks.tx),
    );
    mocks.count.mockResolvedValue(0);
    mocks.findMany.mockResolvedValue([]);
  });

  it('lọc theo kỹ năng, chỉ lấy thợ đang hoạt động + đã duyệt KYC, sắp xếp xác định + phân trang', async () => {
    await staffProfileService.browse({ category: 'PLUMBING', page: 2, limit: 10 });

    const query = mocks.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({
      skills: { some: { category: 'PLUMBING' } },
      user: { role: 'STAFF', isActive: true, kycSubmission: { is: { status: 'APPROVED' } } },
    });
    expect(query).toMatchObject({
      orderBy: [{ isAvailable: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
      skip: 10,
      take: 10,
    });
  });

  it('payload công khai không chứa email hay toạ độ', async () => {
    await staffProfileService.browse({});

    const select = mocks.findMany.mock.calls[0][0].select;
    expect(select.latitude).toBeUndefined();
    expect(select.longitude).toBeUndefined();
    expect(select.user.select.email).toBeUndefined();
    expect(select.user.select.phone).toBeUndefined();
  });
});
