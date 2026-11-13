import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maintenanceApplicationService } from '../../src/services/maintenanceApplication.service';

/**
 * Test lớp service "đơn ứng tuyển & giao việc" (Prisma được mock toàn bộ).
 *
 * Các test dưới đây khoá lại những bất biến quan trọng nhất của Batch 2:
 * - cổng KYC được gọi TRONG transaction và fail closed;
 * - thợ bị khoá / chưa có hồ sơ / đang tắt nhận việc / sai kỹ năng đều bị chặn;
 * - không thể có hai đơn PENDING cho cùng một thợ + công việc;
 * - giao việc là thao tác có điều kiện: request thua cuộc đua nhận 409;
 * - chủ trọ khác không đọc được đơn của công việc không thuộc mình.
 */
const mocks = vi.hoisted(() => {
  const tx = {
    maintenanceTask: { findFirst: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    maintenanceTaskApplication: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    kycSubmission: { findUnique: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(),
    taskFindFirst: vi.fn(),
    applicationFindUnique: vi.fn(),
    applicationFindFirst: vi.fn(),
    applicationFindUniqueOrThrow: vi.fn(),
    applicationFindMany: vi.fn(),
    applicationUpdateMany: vi.fn(),
    notify: vi.fn(),
  };
});

vi.mock('../../src/config/db', () => ({
  default: {
    $transaction: mocks.transaction,
    maintenanceTask: { findFirst: mocks.taskFindFirst },
    maintenanceTaskApplication: {
      findUnique: mocks.applicationFindUnique,
      findFirst: mocks.applicationFindFirst,
      findUniqueOrThrow: mocks.applicationFindUniqueOrThrow,
      findMany: mocks.applicationFindMany,
      updateMany: mocks.applicationUpdateMany,
    },
  },
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { createNotification: mocks.notify },
}));

const OPEN_TASK = {
  id: 'task-1',
  title: 'Sửa trần nhà tắm',
  landlordId: 'landlord-1',
  status: 'OPEN' as const,
  category: 'PLUMBING',
  skills: [] as Array<{ category: string }>,
};

const ELIGIBLE_STAFF = {
  role: 'STAFF',
  isActive: true,
  staffProfile: {
    id: 'profile-1',
    isAvailable: true,
    skills: [{ category: 'PLUMBING' }],
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(mocks.tx),
  );
  mocks.notify.mockResolvedValue({ id: 'notification-1' });
  mocks.tx.maintenanceTask.findFirst.mockResolvedValue(OPEN_TASK);
  mocks.tx.kycSubmission.findUnique.mockResolvedValue({ status: 'APPROVED' });
  mocks.tx.user.findUnique.mockResolvedValue(ELIGIBLE_STAFF);
  mocks.tx.maintenanceTaskApplication.findUnique.mockResolvedValue(null);
  mocks.tx.maintenanceTaskApplication.create.mockResolvedValue({ id: 'application-1', status: 'PENDING' });
  mocks.tx.maintenanceTaskApplication.update.mockResolvedValue({ id: 'application-1', status: 'PENDING' });
  // 🆕 (L4) `apply` chốt lại "còn OPEN" ngay trước khi ghi đơn.
  mocks.tx.maintenanceTask.updateMany.mockResolvedValue({ count: 1 });
});

describe('maintenanceApplicationService.apply — cổng KYC', () => {
  it('chặn ứng tuyển khi KYC chưa nộp/chưa duyệt và không ghi gì', async () => {
    mocks.tx.kycSubmission.findUnique.mockResolvedValue(null);

    await expect(maintenanceApplicationService.apply('staff-1', 'task-1', {})).rejects.toMatchObject({
      statusCode: 403,
      code: 'STAFF_KYC_REQUIRED',
    });
    expect(mocks.tx.maintenanceTaskApplication.create).not.toHaveBeenCalled();
    expect(mocks.tx.maintenanceTaskApplication.update).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('fail closed với cả PENDING và REJECTED', async () => {
    mocks.tx.kycSubmission.findUnique.mockResolvedValue({ status: 'PENDING' });
    await expect(maintenanceApplicationService.apply('staff-1', 'task-1', {})).rejects.toMatchObject({
      code: 'STAFF_KYC_REQUIRED',
    });

    mocks.tx.kycSubmission.findUnique.mockResolvedValue({ status: 'REJECTED' });
    await expect(maintenanceApplicationService.apply('staff-1', 'task-1', {})).rejects.toMatchObject({
      code: 'STAFF_KYC_REQUIRED',
    });
  });

  it('đọc KYC bằng client của TRANSACTION, không dùng client toàn cục', async () => {
    await maintenanceApplicationService.apply('staff-1', 'task-1', {});

    expect(mocks.tx.kycSubmission.findUnique).toHaveBeenCalledWith({
      where: { userId: 'staff-1' },
      select: { status: true },
    });
  });
});

describe('maintenanceApplicationService.apply — điều kiện nghiệp vụ', () => {
  it('công việc không còn OPEN thì 409 và chưa cần kiểm tra KYC', async () => {
    mocks.tx.maintenanceTask.findFirst.mockResolvedValue({ ...OPEN_TASK, status: 'ASSIGNED' });

    await expect(maintenanceApplicationService.apply('staff-1', 'task-1', {})).rejects.toMatchObject({
      statusCode: 409,
      code: 'TASK_NOT_OPEN',
    });
    expect(mocks.tx.kycSubmission.findUnique).not.toHaveBeenCalled();
  });

  it('tài khoản bị khoá không được ứng tuyển', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ ...ELIGIBLE_STAFF, isActive: false });

    await expect(maintenanceApplicationService.apply('staff-1', 'task-1', {})).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_INACTIVE',
    });
  });

  it('thiếu hồ sơ thợ thì 409', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ ...ELIGIBLE_STAFF, staffProfile: null });

    await expect(maintenanceApplicationService.apply('staff-1', 'task-1', {})).rejects.toMatchObject({
      statusCode: 409,
      code: 'STAFF_PROFILE_REQUIRED',
    });
  });

  it('đang tắt trạng thái nhận việc thì 409', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({
      ...ELIGIBLE_STAFF,
      staffProfile: { ...ELIGIBLE_STAFF.staffProfile, isAvailable: false },
    });

    await expect(maintenanceApplicationService.apply('staff-1', 'task-1', {})).rejects.toMatchObject({
      statusCode: 409,
      code: 'STAFF_NOT_AVAILABLE',
    });
  });

  it('kỹ năng không khớp yêu cầu công việc thì 403', async () => {
    mocks.tx.maintenanceTask.findFirst.mockResolvedValue({ ...OPEN_TASK, skills: [{ category: 'CLEANING' }] });

    await expect(maintenanceApplicationService.apply('staff-1', 'task-1', {})).rejects.toMatchObject({
      statusCode: 403,
      code: 'STAFF_SKILL_MISMATCH',
    });
  });

  it('đơn PENDING trùng bị chặn (chống ứng tuyển lặp)', async () => {
    mocks.tx.maintenanceTaskApplication.findUnique.mockResolvedValue({ id: 'application-1', status: 'PENDING' });

    await expect(maintenanceApplicationService.apply('staff-1', 'task-1', {})).rejects.toMatchObject({
      statusCode: 409,
      code: 'DUPLICATE_APPLICATION',
    });
    expect(mocks.tx.maintenanceTaskApplication.create).not.toHaveBeenCalled();
  });

  /**
   * 🆕 Batch 2.1 (L4) — cuộc đua ứng tuyển / giao việc.
   * Trạng thái đọc ở đầu transaction không phải là chốt; `updateMany(...status:
   * 'OPEN')` mới là chốt, và thua thì KHÔNG ghi đơn.
   */
  it('công việc vừa bị giao trong lúc ứng tuyển: 409 và không tạo đơn PENDING', async () => {
    mocks.tx.maintenanceTask.updateMany.mockResolvedValue({ count: 0 });

    await expect(maintenanceApplicationService.apply('staff-1', 'task-1', {})).rejects.toMatchObject({
      statusCode: 409,
      code: 'TASK_NOT_OPEN',
    });

    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-1', status: 'OPEN' },
      data: { status: 'OPEN' },
    });
    expect(mocks.tx.maintenanceTaskApplication.create).not.toHaveBeenCalled();
    expect(mocks.tx.maintenanceTaskApplication.update).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});

describe('maintenanceApplicationService.apply — đường thành công', () => {
  it('tạo đơn, báo cho chủ trọ SAU khi transaction commit', async () => {
    const application = await maintenanceApplicationService.apply('staff-1', 'task-1', { message: 'Tôi nhận việc' });

    expect(application).toMatchObject({ id: 'application-1' });
    expect(mocks.tx.maintenanceTaskApplication.create).toHaveBeenCalledWith({
      data: { taskId: 'task-1', staffId: 'staff-1', message: 'Tôi nhận việc', proposedAmount: null },
      select: expect.any(Object),
    });
    expect(mocks.notify).toHaveBeenCalledWith(
      'landlord-1',
      'Có thợ ứng tuyển công việc',
      expect.stringContaining('Sửa trần nhà tắm'),
      'TASK',
      'task-1',
    );
  });

  it('ứng tuyển lại sau khi rút dùng lại bản ghi cũ thay vì tạo bản ghi thứ hai', async () => {
    mocks.tx.maintenanceTaskApplication.findUnique.mockResolvedValue({ id: 'application-9', status: 'WITHDRAWN' });

    await maintenanceApplicationService.apply('staff-1', 'task-1', {});

    expect(mocks.tx.maintenanceTaskApplication.update).toHaveBeenCalledWith({
      where: { id: 'application-9' },
      data: { status: 'PENDING', message: null, proposedAmount: null, reviewedAt: null },
      select: expect.any(Object),
    });
    expect(mocks.tx.maintenanceTaskApplication.create).not.toHaveBeenCalled();
  });
});


describe('maintenanceApplicationService.accept — giao việc nguyên tử', () => {
  beforeEach(() => {
    mocks.tx.maintenanceTaskApplication.findFirst.mockResolvedValue({
      id: 'application-1',
      staffId: 'staff-1',
      status: 'PENDING',
    });
    mocks.tx.maintenanceTask.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.maintenanceTaskApplication.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.maintenanceTaskApplication.findMany.mockResolvedValue([{ staffId: 'staff-2' }]);
    mocks.tx.maintenanceTask.findUniqueOrThrow.mockResolvedValue({ id: 'task-1', title: 'Sửa trần nhà tắm' });
  });

  it('request thua cuộc đua nhận 409 và không ghi đơn nào', async () => {
    mocks.tx.maintenanceTask.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      maintenanceApplicationService.accept('landlord-1', 'task-1', 'application-1'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'TASK_ALREADY_ASSIGNED' });
    expect(mocks.tx.maintenanceTaskApplication.updateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('đọc lại KYC trong transaction: KYC vừa bị từ chối thì không giao việc', async () => {
    mocks.tx.kycSubmission.findUnique.mockResolvedValue({ status: 'REJECTED' });

    await expect(
      maintenanceApplicationService.accept('landlord-1', 'task-1', 'application-1'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'STAFF_KYC_REQUIRED' });
    expect(mocks.tx.maintenanceTask.updateMany).not.toHaveBeenCalled();
  });

  it('chủ trọ khác không giao việc được (404)', async () => {
    await expect(
      maintenanceApplicationService.accept('landlord-2', 'task-1', 'application-1'),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.tx.maintenanceTask.updateMany).not.toHaveBeenCalled();
  });

  /**
   * 🆕 Batch 2.1 (L5) — hồ sơ thợ có thể đổi giữa lúc ứng tuyển và lúc giao
   * việc. Cả ba trường hợp dưới đây phải hỏng TRƯỚC khi giành việc, nên không
   * có cập nhật dở dang (task/application giữ nguyên) và đơn PENDING vẫn còn
   * cho chủ trọ xử lý.
   */
  it('thợ đã tắt nhận việc: 409 STAFF_NOT_AVAILABLE và không giành việc', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({
      ...ELIGIBLE_STAFF,
      staffProfile: { ...ELIGIBLE_STAFF.staffProfile, isAvailable: false },
    });

    await expect(
      maintenanceApplicationService.accept('landlord-1', 'task-1', 'application-1'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'STAFF_NOT_AVAILABLE' });

    expect(mocks.tx.maintenanceTask.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.maintenanceTaskApplication.updateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('thợ đã xoá kỹ năng phù hợp: 409 STAFF_SKILL_MISMATCH', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({
      ...ELIGIBLE_STAFF,
      staffProfile: { ...ELIGIBLE_STAFF.staffProfile, skills: [{ category: 'CLEANING' }] },
    });

    await expect(
      maintenanceApplicationService.accept('landlord-1', 'task-1', 'application-1'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'STAFF_SKILL_MISMATCH' });
    expect(mocks.tx.maintenanceTask.updateMany).not.toHaveBeenCalled();
  });

  it('thợ không còn hồ sơ: 409 STAFF_PROFILE_REQUIRED', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ ...ELIGIBLE_STAFF, staffProfile: null });

    await expect(
      maintenanceApplicationService.accept('landlord-1', 'task-1', 'application-1'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'STAFF_PROFILE_REQUIRED' });
    expect(mocks.tx.maintenanceTask.updateMany).not.toHaveBeenCalled();
  });

  it('kỹ năng của công việc được đối chiếu theo `skills` khi có yêu cầu riêng', async () => {
    mocks.tx.maintenanceTask.findFirst.mockResolvedValue({
      ...OPEN_TASK,
      skills: [{ category: 'ELECTRICAL' }],
    });

    await expect(
      maintenanceApplicationService.accept('landlord-1', 'task-1', 'application-1'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'STAFF_SKILL_MISMATCH' });
  });

  it('giao việc thành công: chốt 1 thợ, từ chối đơn còn lại và báo cho cả ba bên', async () => {
    await maintenanceApplicationService.accept('landlord-1', 'task-1', 'application-1');

    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-1', landlordId: 'landlord-1', status: 'OPEN' },
      data: {
        status: 'ASSIGNED',
        assignedStaffId: 'staff-1',
        assignedApplicationId: 'application-1',
        assignedAt: expect.any(Date),
      },
    });
    expect(mocks.tx.maintenanceTaskApplication.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'application-1', status: 'PENDING' },
      data: { status: 'ACCEPTED', reviewedAt: expect.any(Date) },
    });
    expect(mocks.tx.maintenanceTaskApplication.updateMany).toHaveBeenNthCalledWith(2, {
      where: { taskId: 'task-1', id: { not: 'application-1' }, status: 'PENDING' },
      data: { status: 'REJECTED', reviewedAt: expect.any(Date) },
    });
    expect(mocks.notify).toHaveBeenCalledTimes(3);
    expect(mocks.notify).toHaveBeenCalledWith(
      'staff-1',
      'Đơn ứng tuyển được chấp nhận',
      expect.any(String),
      'TASK',
      'task-1',
    );
    expect(mocks.notify).toHaveBeenCalledWith('landlord-1', 'Đã giao việc cho thợ', expect.any(String), 'TASK', 'task-1');
    expect(mocks.notify).toHaveBeenCalledWith(
      'staff-2',
      'Đơn ứng tuyển bị từ chối',
      expect.any(String),
      'TASK',
      'task-1',
    );
  });
});

describe('maintenanceApplicationService.withdraw', () => {
  it('không cho rút đơn đã được chấp nhận', async () => {
    mocks.applicationFindUnique.mockResolvedValue({
      id: 'application-1',
      status: 'ACCEPTED',
      task: { id: 'task-1', title: 'Sửa trần nhà tắm', landlordId: 'landlord-1', status: 'ASSIGNED' },
    });

    await expect(maintenanceApplicationService.withdraw('staff-1', 'task-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'APPLICATION_LOCKED',
    });
    expect(mocks.applicationUpdateMany).not.toHaveBeenCalled();
  });

  it('thua cuộc đua với lệnh chấp nhận thì trả 409 và không báo cho chủ trọ', async () => {
    mocks.applicationFindUnique.mockResolvedValue({
      id: 'application-1',
      status: 'PENDING',
      task: { id: 'task-1', title: 'Sửa trần nhà tắm', landlordId: 'landlord-1', status: 'OPEN' },
    });
    mocks.applicationUpdateMany.mockResolvedValue({ count: 0 });

    await expect(maintenanceApplicationService.withdraw('staff-1', 'task-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'APPLICATION_STATE_CONFLICT',
    });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});

describe('maintenanceApplicationService.listForTask', () => {
  it('chủ trọ khác nhận 404 và không đọc được đơn nào (chống IDOR)', async () => {
    mocks.taskFindFirst.mockResolvedValue(null);

    await expect(maintenanceApplicationService.listForTask('landlord-2', 'task-1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mocks.taskFindFirst).toHaveBeenCalledWith({ where: { id: 'task-1', landlordId: 'landlord-2' }, select: { id: true } });
    expect(mocks.applicationFindMany).not.toHaveBeenCalled();
  });
});
