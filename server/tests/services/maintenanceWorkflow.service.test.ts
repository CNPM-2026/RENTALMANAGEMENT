import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maintenanceWorkflowService } from '../../src/services/maintenanceWorkflow.service';

/**
 * BATCH 3 — test lớp "thực thi công việc & vòng đời nghiệm thu" (Prisma mock
 * toàn bộ). Trọng tâm là các bất biến KHÔNG được phép vỡ:
 *  - chỉ đúng thợ được giao mới bắt đầu/nộp được (danh tính từ token);
 *  - KYC + tài khoản được đọc lại TRONG transaction, SAU khi đã giành khoá hàng;
 *  - chuyển trạng thái là compare-and-set: request thua cuộc nhận 409, không ghi;
 *  - hai lần nộp trùng / xác nhận vs yêu cầu làm lại đồng thời có đúng một bên thắng;
 *  - thông báo + audit chỉ phát SAU commit;
 *  - ảnh nghiệm thu là asset riêng tư, payload chỉ có đường dẫn kèm token.
 */
const mocks = vi.hoisted(() => {
  const events: string[] = [];
  const tx = {
    maintenanceTask: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    maintenanceRequest: { updateMany: vi.fn() },
    maintenanceTaskImage: { createMany: vi.fn() },
    user: { findUnique: vi.fn() },
    kycSubmission: { findUnique: vi.fn() },
  };
  return {
    events,
    tx,
    transaction: vi.fn(),
    taskFindFirst: vi.fn(),
    taskFindMany: vi.fn(),
    notify: vi.fn(),
    audit: vi.fn(),
    uploadPrivateImage: vi.fn(),
    deleteImage: vi.fn(),
  };
});

vi.mock('../../src/config/db', () => ({
  default: {
    $transaction: mocks.transaction,
    maintenanceTask: { findFirst: mocks.taskFindFirst, findMany: mocks.taskFindMany },
  },
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { createNotification: mocks.notify },
}));

vi.mock('../../src/services/audit.service', () => ({
  auditService: { record: mocks.audit },
}));

vi.mock('../../src/services/storage.service', () => ({
  storageService: {
    uploadPrivateImage: mocks.uploadPrivateImage,
    deleteImage: mocks.deleteImage,
    isPrivateRef: (ref: string) => Boolean(ref) && !ref.includes('://'),
  },
}));

const TASK_ID = 'task-1';
const ISSUE_ID = 'issue-1';
const LANDLORD_ID = 'landlord-1';
const STAFF_ID = 'staff-1';
const OTHER_STAFF_ID = 'staff-2';

type Status = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED' | 'CANCELLED';

/** Bản ghi công việc tối thiểu mà service đọc (đúng các cột trong `select`). */
const taskRow = (status: Status, overrides: Record<string, unknown> = {}) => ({
  id: TASK_ID,
  title: 'Sửa trần nhà tắm',
  landlordId: LANDLORD_ID,
  status,
  assignedStaffId: STAFF_ID,
  sourceIssueId: ISSUE_ID,
  // Batch 3: thợ chỉ được bắt đầu khi hai bên ĐÃ CHỐT GIÁ.
  agreedAmount: '500000.00',
  ...overrides,
});

/** Kết quả `findUniqueOrThrow({ select: taskDetailSelect })` sau khi ghi. */
const detailRow = (status: Status, overrides: Record<string, unknown> = {}) => ({
  ...taskRow(status, overrides),
  propertyId: 'property-1',
  roomId: null,
  description: 'Trần nhà tắm bị thấm nước.',
  category: 'PLUMBING',
  address: '12 Nguyễn Trãi, Hà Nội',
  latitude: 21.02,
  longitude: 105.83,
  budgetMin: null,
  budgetMax: null,
  urgency: 'MEDIUM',
  preferredStartAt: null,
  preferredEndAt: null,
  additionalInstructions: null,
  assignedApplicationId: null,
  assignedAt: new Date('2026-11-01T00:00:00.000Z'),
  startedAt: null,
  completionSubmittedAt: null,
  completionNote: null,
  completionReviewedAt: null,
  completionReviewNote: null,
  completionAttempts: 0,
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
  updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  property: { id: 'property-1', name: 'Nhà A', address: '12 Nguyễn Trãi' },
  room: null,
  skills: [],
  images: [],
  ...overrides,
});

const fakeFile = (name: string) =>
  ({ originalname: name, mimetype: 'image/jpeg', buffer: Buffer.from('x') }) as unknown as Express.Multer.File;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.events.length = 0;

  // Transaction: chạy callback trên `tx`, chỉ đánh dấu "commit" khi THÀNH CÔNG —
  // nhờ vậy các test dưới đây chứng minh được thông báo phát sau commit.
  mocks.transaction.mockImplementation(async (arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    const result = await (arg as (tx: unknown) => unknown)(mocks.tx);
    mocks.events.push('commit');
    return result;
  });

  mocks.notify.mockImplementation(async () => {
    mocks.events.push('notify');
    return { id: 'notification-1' };
  });
  mocks.audit.mockImplementation(async () => {
    mocks.events.push('audit');
    return { id: 'audit-1' };
  });
  mocks.deleteImage.mockResolvedValue(undefined);
  mocks.uploadPrivateImage.mockResolvedValue('rental-management/maintenance-tasks/completion-1');

  mocks.taskFindFirst.mockResolvedValue(taskRow('ASSIGNED'));
  mocks.tx.maintenanceTask.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.maintenanceTask.findUniqueOrThrow.mockImplementation(async () => detailRow('IN_PROGRESS'));
  mocks.tx.maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.maintenanceTaskImage.createMany.mockResolvedValue({ count: 0 });
  mocks.tx.user.findUnique.mockResolvedValue({ role: 'STAFF', isActive: true });
  mocks.tx.kycSubmission.findUnique.mockResolvedValue({ status: 'APPROVED' });
});

const expectAppError = async (
  promise: Promise<unknown>,
  statusCode: number,
  code: string,
) => {
  await expect(promise).rejects.toMatchObject({ statusCode, code });
};

describe('maintenanceWorkflowService.start — quyền & KYC', () => {
  it('thợ KHÔNG được giao việc không thể bắt đầu (404, không mở transaction)', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('ASSIGNED', { assignedStaffId: OTHER_STAFF_ID }));

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 404, 'TASK_NOT_ASSIGNED_TO_YOU');
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('công việc không tồn tại -> 404', async () => {
    mocks.taskFindFirst.mockResolvedValue(null);

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 404, 'TASK_NOT_ASSIGNED_TO_YOU');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('KYC đang chờ duyệt -> 403 STAFF_KYC_REQUIRED và không ghi/không báo', async () => {
    mocks.tx.kycSubmission.findUnique.mockResolvedValue({ status: 'PENDING' });

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 403, 'STAFF_KYC_REQUIRED');
    // Đã giữ khoá hàng rồi mới kiểm tra KYC: transaction có chạy nhưng FAIL,
    // nên thay đổi trạng thái bị rollback và không có thông báo nào.
    expect(mocks.events).toEqual([]);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('KYC bị từ chối -> 403 STAFF_KYC_REQUIRED', async () => {
    mocks.tx.kycSubmission.findUnique.mockResolvedValue({ status: 'REJECTED' });

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 403, 'STAFF_KYC_REQUIRED');
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('chưa từng nộp KYC (không có bản ghi) -> 403 STAFF_KYC_REQUIRED', async () => {
    mocks.tx.kycSubmission.findUnique.mockResolvedValue(null);

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 403, 'STAFF_KYC_REQUIRED');
  });

  it('tài khoản bị khoá -> 403 ACCOUNT_INACTIVE (kiểm tra lại trong transaction)', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ role: 'STAFF', isActive: false });

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 403, 'ACCOUNT_INACTIVE');
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('tài khoản không còn role STAFF -> 403 STAFF_ROLE_REQUIRED', async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ role: 'TENANT', isActive: true });

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 403, 'STAFF_ROLE_REQUIRED');
  });
});

describe('maintenanceWorkflowService.start — bắt buộc chốt giá (Batch 3)', () => {
  it('chưa có agreedAmount -> 409 PRICE_NOT_AGREED, không mở transaction, không báo', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('ASSIGNED', { agreedAmount: null }));

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 409, 'PRICE_NOT_AGREED');
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('giá bị xoá NGAY SAU khi giành khoá hàng -> 409 và rollback (đọc lại trong transaction)', async () => {
    // Lần đọc đầu (ngoài transaction) vẫn thấy giá; lần đọc lại bên trong
    // transaction thấy null — mô phỏng một transaction khác vừa huỷ thoả thuận.
    mocks.tx.maintenanceTask.findUniqueOrThrow.mockResolvedValueOnce({ agreedAmount: null });

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 409, 'PRICE_NOT_AGREED');
    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.events).toEqual([]);
  });
});

describe('maintenanceWorkflowService.start — chuyển trạng thái', () => {
  it('ASSIGNED -> IN_PROGRESS: ghi có điều kiện, cập nhật sự cố, báo SAU commit', async () => {
    mocks.tx.maintenanceTask.findUniqueOrThrow.mockResolvedValue(detailRow('IN_PROGRESS'));

    const payload = (await maintenanceWorkflowService.start(STAFF_ID, TASK_ID)) as {
      status: string;
      images: unknown[];
      completionImages: unknown[];
    };

    expect(payload.status).toBe('IN_PROGRESS');
    // Conditional write: phải giữ đủ id + chủ thể + trạng thái nguồn.
    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: TASK_ID, assignedStaffId: STAFF_ID, status: 'ASSIGNED' },
      data: { status: 'IN_PROGRESS', startedAt: expect.any(Date) },
    });
    // Sự cố nguồn: chỉ PENDING -> IN_PROGRESS (không đè CANCELLED/COMPLETED).
    expect(mocks.tx.maintenanceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: ISSUE_ID, status: 'PENDING' },
      data: { status: 'IN_PROGRESS' },
    });
    // Thông báo cho CHỦ TRỌ lấy từ quan hệ DB, không phải từ client.
    expect(mocks.notify).toHaveBeenCalledWith(
      LANDLORD_ID,
      expect.any(String),
      expect.stringContaining('bắt đầu'),
      'TASK',
      TASK_ID,
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: STAFF_ID,
        action: 'MAINTENANCE_TASK_START',
        entityType: 'MaintenanceTask',
        entityId: TASK_ID,
      }),
    );
    // Bất biến "chỉ sau commit": commit đứng TRƯỚC thông báo.
    expect(mocks.events).toEqual(['commit', 'notify', 'audit']);
  });

  it('thua cuộc đua (UPDATE khớp 0 hàng) -> 409 và không thông báo', async () => {
    mocks.tx.maintenanceTask.updateMany.mockResolvedValue({ count: 0 });

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 409, 'TASK_STATE_CONFLICT');
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.tx.maintenanceRequest.updateMany).not.toHaveBeenCalled();
  });

  it('công việc đã huỷ không thể bắt đầu', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('CANCELLED'));

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 409, 'TASK_CANCELLED');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('công việc đã hoàn thành không thể "mở lại" bằng request cũ', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('COMPLETED'));

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 409, 'TASK_COMPLETED');
  });

  it('đang chờ nghiệm thu thì không bắt đầu lại', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('SUBMITTED'));

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 409, 'TASK_AWAITING_REVIEW');
  });

  it('bắt đầu hai lần -> 409 TASK_ALREADY_STARTED', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('IN_PROGRESS'));

    await expectAppError(maintenanceWorkflowService.start(STAFF_ID, TASK_ID), 409, 'TASK_ALREADY_STARTED');
  });
});


describe('maintenanceWorkflowService.submitCompletion — quyền, KYC, trùng lặp', () => {
  beforeEach(() => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('IN_PROGRESS'));
    mocks.tx.maintenanceTask.findUniqueOrThrow.mockImplementation(async () => detailRow('SUBMITTED'));
  });

  it('thợ khác không nộp hộ được (404)', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('IN_PROGRESS', { assignedStaffId: OTHER_STAFF_ID }));

    await expectAppError(
      maintenanceWorkflowService.submitCompletion(STAFF_ID, TASK_ID, { note: 'Đã xong' }),
      404,
      'TASK_NOT_ASSIGNED_TO_YOU',
    );
    expect(mocks.uploadPrivateImage).not.toHaveBeenCalled();
  });

  it('chưa bắt đầu thì không thể gửi nghiệm thu', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('ASSIGNED'));

    await expectAppError(
      maintenanceWorkflowService.submitCompletion(STAFF_ID, TASK_ID, { note: 'Đã xong' }),
      409,
      'TASK_NOT_STARTED',
    );
  });

  it('nộp trùng khi đang chờ duyệt -> 409 COMPLETION_ALREADY_SUBMITTED', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('SUBMITTED'));

    await expectAppError(
      maintenanceWorkflowService.submitCompletion(STAFF_ID, TASK_ID, { note: 'Đã xong' }),
      409,
      'COMPLETION_ALREADY_SUBMITTED',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('công việc đã huỷ không nhận nghiệm thu', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('CANCELLED'));

    await expectAppError(
      maintenanceWorkflowService.submitCompletion(STAFF_ID, TASK_ID, { note: 'Đã xong' }),
      409,
      'TASK_CANCELLED',
    );
  });

  it('không có ảnh nghiệm thu -> 400 COMPLETION_EVIDENCE_REQUIRED', async () => {
    await expectAppError(
      maintenanceWorkflowService.submitCompletion(STAFF_ID, TASK_ID, {}),
      400,
      'COMPLETION_EVIDENCE_REQUIRED',
    );
    expect(mocks.uploadPrivateImage).not.toHaveBeenCalled();
  });

  it('KYC bị thu hồi trước khi nộp -> 403, xoá ảnh vừa upload, không báo', async () => {
    mocks.tx.kycSubmission.findUnique.mockResolvedValue({ status: 'REJECTED' });
    mocks.uploadPrivateImage.mockResolvedValue('rental-management/maintenance-tasks/completion-x');

    await expectAppError(
      maintenanceWorkflowService.submitCompletion(STAFF_ID, TASK_ID, { note: 'Đã xong' }, [
        fakeFile('after.jpg'),
      ]),
      403,
      'STAFF_KYC_REQUIRED',
    );
    // Ảnh đã lên Cloudinary nhưng transaction rollback -> phải dọn asset.
    expect(mocks.deleteImage).toHaveBeenCalledWith(
      'rental-management/maintenance-tasks/completion-x',
      'authenticated',
    );
    expect(mocks.tx.maintenanceTaskImage.createMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });


  it('nộp hợp lệ: trạng thái SUBMITTED, ảnh là COMPLETION, báo chủ trọ sau commit', async () => {
    mocks.uploadPrivateImage.mockResolvedValue('rental-management/maintenance-tasks/completion-1');
    mocks.tx.maintenanceTask.findUniqueOrThrow.mockResolvedValue(
      detailRow('SUBMITTED', {
        completionAttempts: 1,
        completionNote: 'Đã thay trần mới',
        completionSubmittedAt: new Date('2026-11-10T00:00:00.000Z'),
        images: [{ id: 'image-after-1', kind: 'COMPLETION' }],
      }),
    );

    const payload = (await maintenanceWorkflowService.submitCompletion(
      STAFF_ID,
      TASK_ID,
      { note: 'Đã thay trần mới' },
      [fakeFile('after.jpg')],
    )) as {
      status: string;
      images: unknown[];
      completionImages: Array<{ id: string; imageUrl: string }>;
    };

    expect(payload.status).toBe('SUBMITTED');
    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: TASK_ID, assignedStaffId: STAFF_ID, status: 'IN_PROGRESS' },
      data: expect.objectContaining({
        status: 'SUBMITTED',
        completionNote: 'Đã thay trần mới',
        completionAttempts: { increment: 1 },
      }),
    });
    expect(mocks.tx.maintenanceTaskImage.createMany).toHaveBeenCalledWith({
      data: [
        {
          taskId: TASK_ID,
          imageUrl: 'rental-management/maintenance-tasks/completion-1',
          kind: 'COMPLETION',
        },
      ],
    });
    // Ảnh nghiệm thu KHÔNG bị trộn vào danh sách ảnh hiện trạng.
    expect(payload.images).toEqual([]);
    expect(payload.completionImages).toHaveLength(1);
    // Đường dẫn có token, không lộ public_id thật.
    expect(payload.completionImages[0].imageUrl).toContain('/api/v1/maintenance-images/task/');
    expect(payload.completionImages[0].imageUrl).toContain('token=');
    expect(JSON.stringify(payload)).not.toContain('rental-management/maintenance-tasks/completion-1');
    expect(mocks.notify).toHaveBeenCalledWith(
      LANDLORD_ID,
      'Thợ đã gửi nghiệm thu',
      expect.stringContaining('kết quả công việc'),
      'TASK',
      TASK_ID,
    );
    expect(mocks.events).toEqual(['commit', 'notify', 'audit']);
  });

  it('chỉ có ghi chú, không có ảnh nghiệm thu -> 400, không upload/báo', async () => {
    await expectAppError(
      maintenanceWorkflowService.submitCompletion(STAFF_ID, TASK_ID, { note: 'Đã xử lý xong' }),
      400,
      'COMPLETION_EVIDENCE_REQUIRED',
    );

    expect(mocks.uploadPrivateImage).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.tx.maintenanceTaskImage.createMany).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it('chỉ có ảnh nghiệm thu (không ghi chú) vẫn hợp lệ', async () => {
    mocks.uploadPrivateImage.mockResolvedValue('rental-management/maintenance-tasks/completion-1');

    await maintenanceWorkflowService.submitCompletion(STAFF_ID, TASK_ID, {}, [fakeFile('after.jpg')]);

    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TASK_ID, assignedStaffId: STAFF_ID, status: 'IN_PROGRESS' },
        data: expect.objectContaining({ status: 'SUBMITTED', completionNote: null }),
      }),
    );
    expect(mocks.tx.maintenanceTaskImage.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });

  it('hai lần nộp đồng thời: lần thứ hai (UPDATE khớp 0 hàng) -> 409, không báo', async () => {
    mocks.tx.maintenanceTask.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await maintenanceWorkflowService.submitCompletion(STAFF_ID, TASK_ID, { note: 'Đã xong lần 1' }, [
      fakeFile('after-1.jpg'),
    ]);
    await expectAppError(
      maintenanceWorkflowService.submitCompletion(STAFF_ID, TASK_ID, { note: 'Đã xong lần 2' }, [
        fakeFile('after-2.jpg'),
      ]),
      409,
      'COMPLETION_STATE_CONFLICT',
    );

    // Chỉ lần thắng mới phát thông báo.
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });
});


describe('maintenanceWorkflowService — chủ trọ duyệt nghiệm thu', () => {
  beforeEach(() => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('SUBMITTED'));
  });

  it('chủ trọ khác không duyệt được (404, không lộ công việc)', async () => {
    // Truy vấn của service luôn kèm `landlordId` -> chủ trọ khác nhận null.
    mocks.taskFindFirst.mockImplementation(async ({ where }: { where: { landlordId?: string } }) =>
      where.landlordId === LANDLORD_ID ? taskRow('SUBMITTED') : null,
    );

    await expectAppError(
      maintenanceWorkflowService.confirmCompletion('landlord-2', TASK_ID, {}),
      404,
      'TASK_NOT_FOUND',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();

    await expectAppError(
      maintenanceWorkflowService.rejectCompletion('landlord-2', TASK_ID, { reason: 'Chưa đạt yêu cầu' }),
      404,
      'TASK_NOT_FOUND',
    );
  });

  it('chưa có nghiệm thu thì không có gì để duyệt', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('IN_PROGRESS'));

    await expectAppError(
      maintenanceWorkflowService.confirmCompletion(LANDLORD_ID, TASK_ID, {}),
      409,
      'COMPLETION_NOT_SUBMITTED',
    );
  });

  it('xác nhận hoàn thành: COMPLETED + sự cố COMPLETED cùng transaction, báo thợ sau commit', async () => {
    mocks.tx.maintenanceTask.findUniqueOrThrow.mockResolvedValue(
      detailRow('COMPLETED', { completionReviewedAt: new Date('2026-11-11T00:00:00.000Z') }),
    );

    const payload = (await maintenanceWorkflowService.confirmCompletion(LANDLORD_ID, TASK_ID, {
      note: 'Đạt yêu cầu',
    })) as { status: string };

    expect(payload.status).toBe('COMPLETED');
    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: TASK_ID, landlordId: LANDLORD_ID, status: 'SUBMITTED' },
      data: expect.objectContaining({ status: 'COMPLETED', completionReviewNote: 'Đạt yêu cầu' }),
    });
    // Sự cố nguồn không được ở trạng thái mâu thuẫn với công việc đã xong.
    expect(mocks.tx.maintenanceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: ISSUE_ID, status: { not: 'COMPLETED' } },
      data: { status: 'COMPLETED', resolvedAt: expect.any(Date) },
    });
    expect(mocks.notify).toHaveBeenCalledWith(
      STAFF_ID,
      expect.any(String),
      expect.stringContaining('xác nhận'),
      'TASK',
      TASK_ID,
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: LANDLORD_ID, action: 'MAINTENANCE_TASK_CONFIRM_COMPLETION' }),
    );
    expect(mocks.events).toEqual(['commit', 'notify', 'audit']);
  });

  it('yêu cầu làm lại: quay về IN_PROGRESS, lưu lý do, báo thợ kèm lý do', async () => {
    mocks.tx.maintenanceTask.findUniqueOrThrow.mockResolvedValue(detailRow('IN_PROGRESS'));

    const payload = (await maintenanceWorkflowService.rejectCompletion(LANDLORD_ID, TASK_ID, {
      reason: 'Trần vẫn còn thấm nước ở góc phải',
    })) as { status: string };

    expect(payload.status).toBe('IN_PROGRESS');
    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith({
      where: { id: TASK_ID, landlordId: LANDLORD_ID, status: 'SUBMITTED' },
      data: expect.objectContaining({
        status: 'IN_PROGRESS',
        completionReviewNote: 'Trần vẫn còn thấm nước ở góc phải',
      }),
    });
    // Từ chối KHÔNG đụng tới sự cố (khách thuê vẫn thấy việc đang xử lý).
    expect(mocks.tx.maintenanceRequest.updateMany).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith(
      STAFF_ID,
      expect.any(String),
      expect.stringContaining('Trần vẫn còn thấm nước ở góc phải'),
      'TASK',
      TASK_ID,
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MAINTENANCE_TASK_REJECT_COMPLETION',
        metadata: expect.objectContaining({ reason: 'Trần vẫn còn thấm nước ở góc phải' }),
      }),
    );
  });

  it('từ chối rồi nộp lại được (không xoá bằng chứng cũ)', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('IN_PROGRESS'));
    mocks.tx.maintenanceTask.findUniqueOrThrow.mockResolvedValue(detailRow('SUBMITTED'));

    await maintenanceWorkflowService.submitCompletion(
      STAFF_ID,
      TASK_ID,
      { note: 'Đã sửa lại góc phải' },
      [fakeFile('after-again.jpg')],
    );

    expect(mocks.tx.maintenanceTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'IN_PROGRESS' }) }),
    );
    // Không có lệnh xoá ảnh nào: bằng chứng lần trước phải còn.
    expect(mocks.deleteImage).not.toHaveBeenCalled();
  });

  it('xác nhận vs yêu cầu làm lại đồng thời: chỉ một bên thắng, bên kia 409', async () => {
    mocks.tx.maintenanceTask.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    mocks.tx.maintenanceTask.findUniqueOrThrow.mockResolvedValue(detailRow('COMPLETED'));

    await maintenanceWorkflowService.confirmCompletion(LANDLORD_ID, TASK_ID, {});
    await expectAppError(
      maintenanceWorkflowService.rejectCompletion(LANDLORD_ID, TASK_ID, {
        reason: 'Thực ra vẫn chưa đạt yêu cầu',
      }),
      409,
      'COMPLETION_REVIEW_CONFLICT',
    );

    expect(mocks.notify).toHaveBeenCalledTimes(1);
    // Sự cố chỉ được cập nhật bởi bên thắng.
    expect(mocks.tx.maintenanceRequest.updateMany).toHaveBeenCalledTimes(1);
  });

  it('transaction thất bại -> không thông báo, không audit', async () => {
    mocks.transaction.mockRejectedValue(new Error('deadlock detected'));

    await expect(maintenanceWorkflowService.confirmCompletion(LANDLORD_ID, TASK_ID, {})).rejects.toThrow(
      'deadlock',
    );
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});


describe('maintenanceWorkflowService.listAssigned — "việc của tôi" của thợ', () => {
  it('chỉ lấy việc giao cho CHÍNH thợ (id từ token) và sắp theo thứ tự nghiệp vụ', async () => {
    const createdAt = new Date('2026-11-01T00:00:00.000Z');
    mocks.taskFindMany.mockResolvedValue([
      { ...detailRow('IN_PROGRESS', { id: 'task-in-progress', createdAt }) },
      { ...detailRow('SUBMITTED', { id: 'task-submitted', createdAt }) },
      { ...detailRow('COMPLETED', { id: 'task-completed', createdAt }) },
    ]);

    const items = (await maintenanceWorkflowService.listAssigned(STAFF_ID)) as Array<{
      id: string;
      images: unknown[];
      completionImages: unknown[];
    }>;

    expect(mocks.taskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { assignedStaffId: STAFF_ID } }),
    );
    expect(items.map((item) => item.id)).toEqual([
      'task-in-progress',
      'task-submitted',
      'task-completed',
    ]);
    // Danh sách không trả ảnh thô nào khác ngoài đường dẫn có token.
    for (const item of items) {
      expect(item.images).toEqual([]);
      expect(item.completionImages).toEqual([]);
    }
  });

  it('lọc theo trạng thái khi client gửi `status`', async () => {
    mocks.taskFindMany.mockResolvedValue([]);

    await maintenanceWorkflowService.listAssigned(STAFF_ID, { status: 'SUBMITTED' });

    expect(mocks.taskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { assignedStaffId: STAFF_ID, status: 'SUBMITTED' } }),
    );
  });
});

describe('maintenanceWorkflowService — ảnh nghiệm thu dùng đúng pipeline bằng chứng', () => {
  it('payload chi tiết: ảnh hiện trạng và ảnh nghiệm thu được tách và đều có token', async () => {
    mocks.taskFindFirst.mockResolvedValue(taskRow('IN_PROGRESS'));
    mocks.tx.maintenanceTask.findUniqueOrThrow.mockImplementation(async () =>
      detailRow('SUBMITTED', {
        images: [
          { id: 'image-before-1', kind: 'TASK' },
          { id: 'image-after-1', kind: 'COMPLETION' },
        ],
      }),
    );

    const payload = (await maintenanceWorkflowService.submitCompletion(
      STAFF_ID,
      TASK_ID,
      { note: 'Đã xong' },
      [fakeFile('after.jpg')],
    )) as {
      images: Array<{ id: string; imageUrl: string }>;
      completionImages: Array<{ id: string; imageUrl: string }>;
    };

    expect(payload.images.map((image) => image.id)).toEqual(['image-before-1']);
    expect(payload.completionImages.map((image) => image.id)).toEqual(['image-after-1']);
    // Cùng một route cấp ảnh có kiểm tra quyền + tải bytes qua server.
    expect(payload.completionImages[0].imageUrl).toMatch(
      /^\/api\/v1\/maintenance-images\/task\/image-after-1\?token=/,
    );
  });
});

