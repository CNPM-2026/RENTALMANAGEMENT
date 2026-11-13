import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maintenanceTaskService } from '../../src/services/maintenanceTask.service';
import type { MaintenanceTaskUpdateInput } from '../../src/validations/maintenanceTask.validation';

/**
 * Test lớp service "công việc bảo trì" KHÔNG cần DB thật (Prisma được mock toàn
 * bộ). Trọng tâm là các bất biến bảo mật:
 * - quyền sở hữu cơ sở/phòng được xác minh ở server;
 * - người ngoài không đọc được công việc đã giao/huỷ (IDOR);
 * - chuyển trạng thái sai bị chặn (409) và lệnh huỷ có điều kiện thua cuộc đua;
 * - payload danh sách không lộ toạ độ, và không bịa khoảng cách.
 */
const mocks = vi.hoisted(() => {
  const tx = {
    maintenanceTaskSkill: { deleteMany: vi.fn(), createMany: vi.fn() },
    maintenanceTask: { update: vi.fn(), updateMany: vi.fn() },
    maintenanceTaskApplication: { findMany: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(),
    propertyFindFirst: vi.fn(),
    roomFindFirst: vi.fn(),
    taskCreate: vi.fn(),
    taskFindFirst: vi.fn(),
    taskFindUnique: vi.fn(),
    taskFindUniqueOrThrow: vi.fn(),
    taskFindMany: vi.fn(),
    taskCount: vi.fn(),
    applicationFindUnique: vi.fn(),
    applicationFindMany: vi.fn(),
    notify: vi.fn(),
    uploadPrivateImage: vi.fn(),
    deleteImage: vi.fn(),
  };
});

vi.mock('../../src/config/db', () => ({
  default: {
    $transaction: mocks.transaction,
    property: { findFirst: mocks.propertyFindFirst },
    room: { findFirst: mocks.roomFindFirst },
    maintenanceTask: {
      create: mocks.taskCreate,
      findFirst: mocks.taskFindFirst,
      findUnique: mocks.taskFindUnique,
      findUniqueOrThrow: mocks.taskFindUniqueOrThrow,
      findMany: mocks.taskFindMany,
      count: mocks.taskCount,
    },
    maintenanceTaskApplication: {
      findUnique: mocks.applicationFindUnique,
      findMany: mocks.applicationFindMany,
    },
  },
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { createNotification: mocks.notify },
}));

vi.mock('../../src/services/storage.service', () => ({
  storageService: {
    // 🆕 Batch 2.1 (M2): ảnh mới là asset riêng tư -> `public_id`.
    uploadPrivateImage: mocks.uploadPrivateImage,
    deleteImage: mocks.deleteImage,
    isPrivateRef: (ref: string) => Boolean(ref) && !ref.includes('://'),
  },
}));

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PROPERTY_ID = '22222222-2222-4222-8222-222222222222';
const ROOM_ID = '33333333-3333-4333-8333-333333333333';

const updateInput = (value: Record<string, unknown> = {}) =>
  ({
    title: 'Sửa trần nhà tắm',
    description: 'Trần nhà tắm bị thấm nước, cần xử lý trước cuối tuần.',
    ...value,
  }) as unknown as MaintenanceTaskUpdateInput;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(mocks.tx),
  );
  mocks.notify.mockResolvedValue({ id: 'notification-1' });
  mocks.deleteImage.mockResolvedValue(undefined);
  // (M1) Lệnh sửa phải GIÀNH được công việc còn OPEN trước khi ghi nội dung.
  mocks.tx.maintenanceTask.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.maintenanceTask.update.mockResolvedValue({ id: 'task-1', status: 'OPEN' });
  mocks.taskCreate.mockResolvedValue({ id: 'task-1', status: 'OPEN' });
  mocks.taskFindUniqueOrThrow.mockResolvedValue({ id: 'task-1', title: 'Sửa trần nhà tắm' });
});

describe('maintenanceTaskService.update', () => {
  it('từ chối khi cơ sở không thuộc chủ trọ đang đăng nhập (không tin propertyId của client)', async () => {
    mocks.taskFindFirst.mockResolvedValue(null);

    await expect(
      maintenanceTaskService.update('landlord-2', 'task-1', updateInput({ title: 'Sửa mái tôn' })),
    ).rejects.toMatchObject({ statusCode: 404 });
    // Truy vấn phải kèm landlordId, không chỉ id.
    expect(mocks.taskFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-1', landlordId: 'landlord-2' } }),
    );
    expect(mocks.tx.maintenanceTask.update).not.toHaveBeenCalled();
  });

  it('từ chối sửa công việc đã giao cho thợ (409 TASK_NOT_OPEN)', async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: 'task-1',
      status: 'ASSIGNED',
      propertyId: PROPERTY_ID,
      images: [],
    });

    await expect(
      maintenanceTaskService.update('landlord-1', 'task-1', updateInput()),
    ).rejects.toMatchObject({ statusCode: 409, code: 'TASK_NOT_OPEN' });
    expect(mocks.tx.maintenanceTask.update).not.toHaveBeenCalled();
  });

  it('không cho chuyển công việc sang cơ sở khác', async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: 'task-1',
      status: 'OPEN',
      propertyId: PROPERTY_ID,
      images: [],
    });

    await expect(
      maintenanceTaskService.update('landlord-1', 'task-1', updateInput({ propertyId: OTHER_PROPERTY_ID })),
    ).rejects.toMatchObject({ statusCode: 400, code: 'TASK_PROPERTY_IMMUTABLE' });
  });

  it('chỉ xoá asset do marketplace tải lên; ảnh tham chiếu từ sự cố được giữ nguyên', async () => {
    const taskAsset = 'https://cdn.example.com/rental-management/maintenance-tasks/cu.jpg';
    const issueAsset = 'https://cdn.example.com/rental-management/maintenance-requests/baocao.jpg';
    mocks.taskFindFirst.mockResolvedValue({
      id: 'task-1',
      status: 'OPEN',
      propertyId: PROPERTY_ID,
      images: [{ imageUrl: taskAsset }, { imageUrl: issueAsset }],
    });
    mocks.uploadPrivateImage.mockResolvedValue('rental-management/maintenance-tasks/moi');

    await maintenanceTaskService.update(
      'landlord-1',
      'task-1',
      updateInput({ title: 'Sửa mái tôn' }),
      [{ originalname: 'moi.jpg' } as Express.Multer.File],
    );

    expect(mocks.tx.maintenanceTask.update).toHaveBeenCalled();
    // Asset cũ là URL công khai -> xoá với `type: 'upload'`.
    expect(mocks.deleteImage).toHaveBeenCalledWith(taskAsset, 'upload');
    // Bằng chứng của khách thuê không thuộc marketplace nên không được xoá.
    expect(mocks.deleteImage).not.toHaveBeenCalledWith(issueAsset, 'upload');
    expect(mocks.deleteImage).not.toHaveBeenCalledWith(issueAsset, 'authenticated');
  });

  /**
   * 🆕 Batch 2.1 (M1) — cuộc đua sửa/giao việc.
   * Câu `updateMany({ id, landlordId, status: 'OPEN' })` là điểm chốt duy nhất:
   * nếu lệnh giao việc đã commit trước, nó khớp 0 hàng và KHÔNG có gì được ghi.
   */
  it('thua cuộc đua với lệnh giao việc: 409 TASK_NOT_OPEN và không ghi kỹ năng/nội dung', async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: 'task-1',
      status: 'OPEN',
      propertyId: PROPERTY_ID,
      images: [],
    });
    mocks.tx.maintenanceTask.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      maintenanceTaskService.update(
        'landlord-1',
        'task-1',
        updateInput({ title: 'Sửa mái tôn', skills: ['PLUMBING'] }),
        [{ originalname: 'moi.jpg' } as Express.Multer.File],
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'TASK_NOT_OPEN' });

    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-1', landlordId: 'landlord-1', status: 'OPEN' },
      data: { status: 'OPEN' },
    });
    // Không có thay đổi nội dung/kỹ năng/ảnh nào được ghi.
    expect(mocks.tx.maintenanceTask.update).not.toHaveBeenCalled();
    expect(mocks.tx.maintenanceTaskSkill.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.maintenanceTaskSkill.createMany).not.toHaveBeenCalled();
  });
});

describe('maintenanceTaskService.getById', () => {
  it('chủ trọ khác không đọc được công việc đã giao (404, không lộ sự tồn tại)', async () => {
    mocks.taskFindUnique.mockResolvedValue({
      id: 'task-1',
      landlordId: 'landlord-1',
      status: 'ASSIGNED',
      assignedStaffId: 'staff-9',
    });
    mocks.applicationFindUnique.mockResolvedValue(null);

    await expect(
      maintenanceTaskService.getById({ id: 'landlord-2', role: 'LANDLORD' }, 'task-1'),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.taskFindUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('công việc còn OPEN thì người dùng đã đăng nhập khác vẫn xem được nhưng KHÔNG thấy đơn ứng tuyển', async () => {
    mocks.taskFindUnique.mockResolvedValue({
      id: 'task-1',
      landlordId: 'landlord-1',
      status: 'OPEN',
      assignedStaffId: null,
    });
    mocks.applicationFindUnique.mockResolvedValue(null);
    mocks.taskFindUniqueOrThrow.mockResolvedValue({
      id: 'task-1',
      title: 'Sửa trần nhà tắm',
      assignedStaff: null,
    });

    const result = await maintenanceTaskService.getById({ id: 'staff-1', role: 'STAFF' }, 'task-1');

    expect(result.isOwner).toBe(false);
    expect(result.applications).toEqual([]);
    expect(mocks.applicationFindMany).not.toHaveBeenCalled();
  });

  it('chủ trọ sở hữu thấy đơn ứng tuyển kèm kycStatus phẳng (không lộ cấu trúc quan hệ)', async () => {
    mocks.taskFindUnique.mockResolvedValue({
      id: 'task-1',
      landlordId: 'landlord-1',
      status: 'OPEN',
      assignedStaffId: null,
    });
    mocks.taskFindUniqueOrThrow.mockResolvedValue({ id: 'task-1', title: 'Sửa trần nhà tắm', assignedStaff: null });
    mocks.applicationFindMany.mockResolvedValue([
      {
        id: 'application-1',
        staffId: 'staff-1',
        status: 'PENDING',
        staff: { id: 'staff-1', fullName: 'Thợ A', phone: '0900', kycSubmission: { status: 'APPROVED' } },
      },
    ]);

    const result = await maintenanceTaskService.getById({ id: 'landlord-1', role: 'LANDLORD' }, 'task-1');

    expect(result.isOwner).toBe(true);
    expect(result.applications).toEqual([
      {
        id: 'application-1',
        staffId: 'staff-1',
        status: 'PENDING',
        staff: { id: 'staff-1', fullName: 'Thợ A', phone: '0900' },
        kycStatus: 'APPROVED',
      },
    ]);
    expect(result.applications[0]).not.toHaveProperty('staff.kycSubmission');
  });

  it('thợ không phải người được giao không thấy số điện thoại liên hệ', async () => {
    mocks.taskFindUnique.mockResolvedValue({
      id: 'task-1',
      landlordId: 'landlord-1',
      status: 'ASSIGNED',
      assignedStaffId: 'staff-2',
    });
    mocks.applicationFindUnique.mockResolvedValue({ id: 'application-1', status: 'REJECTED' });
    mocks.taskFindUniqueOrThrow.mockResolvedValue({
      id: 'task-1',
      title: 'Sửa trần nhà tắm',
      assignedStaff: { id: 'staff-2', fullName: 'Thợ B', avatarUrl: null, phone: '0911' },
    });

    const result = await maintenanceTaskService.getById({ id: 'staff-1', role: 'STAFF' }, 'task-1');

    expect(result.assignedStaff).toEqual({ id: 'staff-2', fullName: 'Thợ B', avatarUrl: null, phone: null });
  });

  /**
   * 🆕 Batch 2.1 (M2) — không cấp token ảnh cho người không có quan hệ với
   * công việc, kể cả khi công việc còn OPEN (danh sách công khai).
   */
  it('người ngoài không nhận được token ảnh của công việc còn OPEN', async () => {
    mocks.taskFindUnique.mockResolvedValue({
      id: 'task-1',
      landlordId: 'landlord-1',
      status: 'OPEN',
      assignedStaffId: null,
    });
    mocks.applicationFindUnique.mockResolvedValue(null);
    mocks.taskFindUniqueOrThrow.mockResolvedValue({
      id: 'task-1',
      title: 'Sửa trần nhà tắm',
      assignedStaff: null,
      images: [{ id: 'img-1' }],
    });

    const result = await maintenanceTaskService.getById({ id: 'tenant-9', role: 'TENANT' }, 'task-1');

    expect(result.images).toEqual([]);
  });

  it('thợ xem công việc còn OPEN nhận được token ảnh (cần xem hiện trạng để ứng tuyển)', async () => {
    mocks.taskFindUnique.mockResolvedValue({
      id: 'task-1',
      landlordId: 'landlord-1',
      status: 'OPEN',
      assignedStaffId: null,
    });
    mocks.applicationFindUnique.mockResolvedValue(null);
    mocks.taskFindUniqueOrThrow.mockResolvedValue({
      id: 'task-1',
      title: 'Sửa trần nhà tắm',
      assignedStaff: null,
      images: [{ id: 'img-1' }],
    });

    const result = await maintenanceTaskService.getById({ id: 'staff-1', role: 'STAFF' }, 'task-1');

    expect(result.images).toEqual([
      { id: 'img-1', imageUrl: expect.stringMatching(/^\/api\/v1\/maintenance-images\/task\/img-1\?token=/) },
    ]);
  });
});

describe('maintenanceTaskService.cancel', () => {
  it('không cho huỷ công việc đã giao cho thợ', async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: 'task-1',
      landlordId: 'landlord-1',
      status: 'ASSIGNED',
      title: 'Sửa trần nhà tắm',
    });

    await expect(maintenanceTaskService.cancel('landlord-1', 'task-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'TASK_ALREADY_ASSIGNED',
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('coi công việc của chủ trọ khác như không tồn tại (404)', async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: 'task-1',
      landlordId: 'landlord-1',
      status: 'OPEN',
      title: 'Sửa trần nhà tắm',
    });

    await expect(maintenanceTaskService.cancel('landlord-2', 'task-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('thua cuộc đua huỷ/giao việc thì trả 409 thay vì huỷ công việc đã có thợ', async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: 'task-1',
      landlordId: 'landlord-1',
      status: 'OPEN',
      title: 'Sửa trần nhà tắm',
    });
    mocks.tx.maintenanceTask.updateMany.mockResolvedValue({ count: 0 });

    await expect(maintenanceTaskService.cancel('landlord-1', 'task-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'TASK_STATE_CONFLICT',
    });
    expect(mocks.tx.maintenanceTaskApplication.updateMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('huỷ thành công thì từ chối các đơn đang chờ và chỉ báo SAU khi commit', async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: 'task-1',
      landlordId: 'landlord-1',
      status: 'OPEN',
      title: 'Sửa trần nhà tắm',
    });
    mocks.tx.maintenanceTask.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.maintenanceTaskApplication.findMany.mockResolvedValue([{ staffId: 'staff-1' }]);
    mocks.tx.maintenanceTaskApplication.updateMany.mockResolvedValue({ count: 1 });

    await maintenanceTaskService.cancel('landlord-1', 'task-1');

    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-1', landlordId: 'landlord-1', status: 'OPEN' },
      data: { status: 'CANCELLED' },
    });
    expect(mocks.tx.maintenanceTaskApplication.updateMany).toHaveBeenCalledWith({
      where: { taskId: 'task-1', status: 'PENDING' },
      data: { status: 'REJECTED', reviewedAt: expect.any(Date) },
    });
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledWith(
      'staff-1',
      'Công việc đã bị huỷ',
      expect.any(String),
      'TASK',
      'task-1',
    );
  });
});

describe('maintenanceTaskService.browseOpen', () => {
  it('chỉ trả công việc OPEN, không lộ toạ độ và không bịa khoảng cách khi thiếu toạ độ', async () => {
    mocks.taskCount.mockResolvedValue(1);
    mocks.taskFindMany.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Sửa trần nhà tắm',
        latitude: 21.03,
        longitude: 105.85,
        applications: [{ id: 'application-1', status: 'PENDING' }],
      },
    ]);

    const result = await maintenanceTaskService.browseOpen('staff-1', { page: 1, limit: 20 });

    expect(mocks.taskCount).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'OPEN' } }));
    expect(result.items[0]).not.toHaveProperty('latitude');
    expect(result.items[0]).not.toHaveProperty('longitude');
    expect(result.items[0]).toMatchObject({
      distanceKm: null,
      myApplication: { id: 'application-1', status: 'PENDING' },
    });
    expect(result.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('lọc theo bán kính ở SQL, loại bản ghi thiếu toạ độ và sắp xếp theo khoảng cách thật', async () => {
    mocks.taskFindMany.mockResolvedValue([
      {
        id: 'task-far',
        title: 'Xa',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        latitude: 21.1,
        longitude: 105.9,
        applications: [],
      },
      {
        id: 'task-near',
        title: 'Gần',
        createdAt: new Date('2026-01-02T00:00:00Z'),
        latitude: 21.0285,
        longitude: 105.8542,
        applications: [],
      },
      { id: 'task-unknown', title: 'Không toạ độ', createdAt: new Date(), latitude: null, longitude: null, applications: [] },
    ]);

    const result = await maintenanceTaskService.browseOpen('staff-1', {
      latitude: 21.0278,
      longitude: 105.8342,
      radiusKm: 20,
      sort: 'nearest',
      page: 1,
      limit: 20,
    });

    const where = mocks.taskFindMany.mock.calls[0][0].where;
    expect(where.status).toBe('OPEN');
    // Có điều kiện bounding box ở SQL thay vì nạp toàn bảng.
    expect(where.AND).toEqual([
      { latitude: { not: null, gte: expect.any(Number), lte: expect.any(Number) } },
      { OR: [{ longitude: { not: null, gte: expect.any(Number), lte: expect.any(Number) } }] },
    ]);
    expect(result.items.map((item: { id: string }) => item.id)).toEqual(['task-near', 'task-far']);
    expect(result.items[0].distanceKm).not.toBeNull();
    expect(result.meta.total).toBe(2);
  });
});
