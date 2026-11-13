import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import type { MaintenanceTaskStatus, Prisma } from '@prisma/client';
import { storageService } from './storage.service';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';
import { assertKycApproved, loadKycState } from './kycGate.service';
import {
  TASK_STATUS_ORDER,
  taskDetailSelect,
  taskSummarySelect,
  toTaskPayload,
} from './maintenanceTask.service';
import type { EvidenceViewer } from './maintenanceEvidence.service';
import type {
  MaintenanceCompletionConfirmInput,
  MaintenanceCompletionRejectInput,
  MaintenanceTaskCompletionInput,
} from '../validations/maintenanceTask.validation';

/**
 * BATCH 3 — THỰC THI CÔNG VIỆC & VÒNG ĐỜI NGHIỆM THU.
 *
 * Luồng (sau khi chủ trọ đã giao việc ở Batch 2):
 *   ASSIGNED --(thợ bắt đầu)--> IN_PROGRESS
 *   IN_PROGRESS --(thợ gửi nghiệm thu)--> SUBMITTED
 *   SUBMITTED --(chủ trọ xác nhận)--> COMPLETED            (kết thúc)
 *   SUBMITTED --(chủ trọ yêu cầu làm lại, BẮT BUỘC lý do)--> IN_PROGRESS
 *
 * Bảng chuyển trạng thái THỰC TẾ mà lớp này cho phép:
 *
 *   | Từ          | Hành động         | Sang        | Ai được phép       |
 *   |-------------|-------------------|-------------|--------------------|
 *   | ASSIGNED    | start             | IN_PROGRESS | đúng thợ được giao |
 *   | IN_PROGRESS | submitCompletion  | SUBMITTED   | đúng thợ được giao |
 *   | SUBMITTED   | confirmCompletion | COMPLETED   | đúng chủ trọ       |
 *   | SUBMITTED   | rejectCompletion  | IN_PROGRESS | đúng chủ trọ       |
 *   | OPEN        | (Batch 2: accept) | ASSIGNED    | đúng chủ trọ       |
 *   | OPEN        | (Batch 2: cancel) | CANCELLED   | đúng chủ trọ       |
 *
 * Mọi cặp khác đều bị từ chối 409 — bao gồm CANCELLED → bất kỳ, COMPLETED →
 * bất kỳ (công việc đã xong không thể bị "mở lại" bởi một request cũ), và
 * SUBMITTED → SUBMITTED (nộp trùng).
 *
 * Ba bất biến được bảo vệ ở đây:
 *
 * 1. QUYỀN: danh tính lấy từ `req.user` (server), không bao giờ từ body/query.
 *    Công việc được đọc lại theo `assignedStaffId` (thợ) hoặc `landlordId` (chủ
 *    trọ) và trả 404 khi không khớp — không lộ sự tồn tại của công việc người
 *    khác. Thợ không được giao việc không thể bắt đầu/nộp hộ người khác.
 *
 * 2. KYC + TÀI KHOẢN: mỗi lần ghi của thợ đều đọc lại `role`, `isActive` và
 *    `kyc_submissions.status` TRONG CÙNG transaction, SAU khi đã giành khoá hàng
 *    công việc (thứ tự này đặt lần đọc KYC sát thời điểm commit nhất có thể;
 *    nếu KYC không còn APPROVED thì `throw` huỷ luôn thay đổi trạng thái vừa
 *    ghi). Không dùng lại trạng thái KYC mà client đã cache.
 *
 * 3. ĐỒNG THỜI: mỗi chuyển trạng thái là MỘT câu `updateMany` có điều kiện
 *    (id + chủ thể + trạng thái nguồn). Hai request song song chỉ một câu trả
 *    `count = 1`; câu còn lại nhận 409 và không ghi gì. Nhờ vậy:
 *    - hai lần nộp nghiệm thu đồng thời không tạo hai lần chuyển trạng thái;
 *    - xác nhận và yêu cầu làm lại chạy song song có ĐÚNG MỘT bên thắng;
 *    - request cũ (stale) không đè lên quyết định mới của chủ trọ.
 *
 * Thông báo và audit chỉ phát SAU khi transaction commit: một transaction bị
 * rollback không bao giờ để lại thông báo "đã hoàn thành".
 */

/** Ảnh nghiệm thu nằm cùng thư mục riêng tư với ảnh hiện trạng của công việc. */
const COMPLETION_IMAGE_FOLDER = 'rental-management/maintenance-tasks';

/** Trần ảnh cho một lần gửi nghiệm thu (route cũng giới hạn `upload.array`). */
export const MAX_COMPLETION_IMAGES = 5;

/** Upload ảnh nghiệm thu: private asset -> `public_id`, dọn rác khi lỗi giữa chừng. */
const completionImagesInput = async (files: Express.Multer.File[]) => {
  if (!files.length) return [];
  const assets: string[] = [];
  try {
    for (const file of files) {
      assets.push(await storageService.uploadPrivateImage(file, COMPLETION_IMAGE_FOLDER));
    }
    return assets;
  } catch (error) {
    await Promise.all(
      assets.map((asset) => storageService.deleteImage(asset, 'authenticated').catch(() => undefined)),
    );
    throw error;
  }
};

/**
 * Đọc lại quyền của thợ NGAY TRONG transaction, sau khi đã giành khoá hàng.
 * Fail closed: thiếu role/không active/KYC chưa duyệt → 403 và rollback.
 */
const assertActiveStaffWithKyc = async (
  tx: Prisma.TransactionClient,
  staffId: string,
  action: string,
) => {
  const staff = await tx.user.findUnique({
    where: { id: staffId },
    select: { role: true, isActive: true },
  });
  if (!staff || staff.role !== 'STAFF') {
    throw new AppError('Chỉ tài khoản thợ mới được thực hiện thao tác này', 403, 'STAFF_ROLE_REQUIRED');
  }
  if (!staff.isActive) {
    throw new AppError('Tài khoản đã bị khoá nên không thể thực hiện thao tác này', 403, 'ACCOUNT_INACTIVE');
  }
  assertKycApproved(await loadKycState(staffId, tx), action);
};


/** Trạng thái không cho phép BẮT ĐẦU — mỗi trường hợp một mã lỗi máy đọc được. */
const blockedStart = (status: MaintenanceTaskStatus): AppError => {
  switch (status) {
    case 'CANCELLED':
      return new AppError('Công việc đã bị huỷ nên không thể bắt đầu', 409, 'TASK_CANCELLED');
    case 'COMPLETED':
      return new AppError('Công việc đã hoàn thành nên không thể bắt đầu lại', 409, 'TASK_COMPLETED');
    case 'SUBMITTED':
      return new AppError(
        'Công việc đang chờ chủ trọ nghiệm thu nên không thể bắt đầu lại',
        409,
        'TASK_AWAITING_REVIEW',
      );
    case 'IN_PROGRESS':
      return new AppError('Công việc đã được bắt đầu trước đó', 409, 'TASK_ALREADY_STARTED');
    default:
      return new AppError(
        'Công việc chưa được giao cho thợ nên không thể bắt đầu',
        409,
        'TASK_NOT_ASSIGNED',
      );
  }
};

/** Trạng thái không cho phép GỬI NGHIỆM THU. */
const blockedSubmit = (status: MaintenanceTaskStatus): AppError => {
  switch (status) {
    case 'ASSIGNED':
      return new AppError(
        'Công việc chưa được bắt đầu nên chưa thể gửi nghiệm thu',
        409,
        'TASK_NOT_STARTED',
      );
    case 'SUBMITTED':
      return new AppError(
        'Bạn đã gửi nghiệm thu và đang chờ chủ trọ xác nhận',
        409,
        'COMPLETION_ALREADY_SUBMITTED',
      );
    case 'COMPLETED':
      return new AppError('Công việc đã được xác nhận hoàn thành', 409, 'TASK_COMPLETED');
    case 'CANCELLED':
      return new AppError('Công việc đã bị huỷ nên không thể gửi nghiệm thu', 409, 'TASK_CANCELLED');
    default:
      return new AppError('Công việc chưa được giao cho thợ', 409, 'TASK_NOT_ASSIGNED');
  }
};

/** Trạng thái không cho phép CHỦ TRỌ DUYỆT nghiệm thu. */
const blockedReview = (status: MaintenanceTaskStatus): AppError => {
  switch (status) {
    case 'COMPLETED':
      return new AppError('Công việc đã được xác nhận hoàn thành trước đó', 409, 'TASK_COMPLETED');
    case 'CANCELLED':
      return new AppError('Công việc đã bị huỷ nên không thể duyệt nghiệm thu', 409, 'TASK_CANCELLED');
    case 'ASSIGNED':
    case 'IN_PROGRESS':
      return new AppError(
        'Thợ chưa gửi nghiệm thu nên chưa có gì để duyệt',
        409,
        'COMPLETION_NOT_SUBMITTED',
      );
    default:
      return new AppError(
        'Công việc không ở trạng thái chờ nghiệm thu',
        409,
        'COMPLETION_NOT_SUBMITTED',
      );
  }
};

/** Sắp xếp theo thứ tự nghiệp vụ (không phụ thuộc thứ tự enum của PostgreSQL). */
const sortByStatusThenNewest = <
  T extends { id: string; status: MaintenanceTaskStatus; createdAt: Date },
>(
  tasks: T[],
) =>
  tasks
    .slice()
    .sort(
      (a, b) =>
        TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status] ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );

export const maintenanceWorkflowService = {
  /**
   * 🆕 Batch 3 — danh sách công việc ĐÃ GIAO cho chính thợ đang đăng nhập.
   *
   * Không nhận `staffId` từ client: id lấy từ token. Chỉ chọn công việc mà
   * `assigned_staff_id` = chính thợ đó, nên không thể đọc việc của thợ khác
   * kể cả khi đoán được id.
   */
  listAssigned: async (staffId: string, query: { status?: MaintenanceTaskStatus } = {}) => {
    const tasks = await prisma.maintenanceTask.findMany({
      where: { assignedStaffId: staffId, ...(query.status ? { status: query.status } : {}) },
      select: {
        ...taskSummarySelect,
        images: { select: { id: true, kind: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    const viewer: EvidenceViewer = { id: staffId, role: 'STAFF' };
    return sortByStatusThenNewest(tasks).map((task) => toTaskPayload(viewer, task));
  },

  /**
   * 🆕 Batch 3 — thợ được giao bắt đầu làm việc.
   *
   * Thứ tự trong transaction:
   *  1. `updateMany` có điều kiện GIÀNH công việc (id + assignedStaffId +
   *     status ASSIGNED) → khoá hàng, chốt lại trạng thái nguồn;
   *  2. đọc lại role/isActive/KYC trong CÙNG transaction (sau khoá) — KYC bị thu
   *     hồi giữa lúc thợ bấm nút và lúc commit thì bước 1 bị rollback;
   *  3. cập nhật sự cố nguồn PENDING → IN_PROGRESS (không đụng CANCELLED/
   *     COMPLETED, cũng không đụng `triageStatus`).
   */
  start: async (staffId: string, taskId: string) => {
    const task = await prisma.maintenanceTask.findFirst({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        landlordId: true,
        status: true,
        assignedStaffId: true,
        sourceIssueId: true,
        agreedAmount: true,
      },
    });
    if (!task || task.assignedStaffId !== staffId) {
      throw new AppError(
        'Không tìm thấy công việc hoặc công việc không được giao cho bạn',
        404,
        'TASK_NOT_ASSIGNED_TO_YOU',
      );
    }
    if (task.status !== 'ASSIGNED') throw blockedStart(task.status);
    // 🆕 Batch 3 — hai bên phải CHỐT GIÁ trước khi bắt đầu. Kiểm tra lại bên
    // trong transaction (sau khi đã giành khoá hàng) để một request song song
    // không thể chen giữa lúc đọc và lúc ghi.
    if (task.agreedAmount == null) {
      throw new AppError(
        'Hai bên chưa thống nhất giá nên chưa thể bắt đầu công việc',
        409,
        'PRICE_NOT_AGREED',
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.maintenanceTask.updateMany({
        where: { id: taskId, assignedStaffId: staffId, status: 'ASSIGNED' },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          'Công việc vừa thay đổi trạng thái, vui lòng tải lại',
          409,
          'TASK_STATE_CONFLICT',
        );
      }

      await assertActiveStaffWithKyc(tx, staffId, 'bắt đầu công việc');

      // Đọc lại giá đã chốt SAU khi đã giữ khoá hàng: nếu một transaction khác
      // vừa huỷ/không còn giá, lần bắt đầu này phải rollback.
      const priced = await tx.maintenanceTask.findUniqueOrThrow({
        where: { id: taskId },
        select: { agreedAmount: true },
      });
      if (priced.agreedAmount == null) {
        throw new AppError(
          'Hai bên chưa thống nhất giá nên chưa thể bắt đầu công việc',
          409,
          'PRICE_NOT_AGREED',
        );
      }

      await tx.maintenanceRequest.updateMany({
        where: { id: task.sourceIssueId, status: 'PENDING' },
        data: { status: 'IN_PROGRESS' },
      });

      return tx.maintenanceTask.findUniqueOrThrow({ where: { id: taskId }, select: taskDetailSelect });
    });

    // --- Sau commit: không bao giờ thông báo cho một thay đổi đã rollback ---
    await notificationService
      .createNotification(
        task.landlordId,
        'Thợ đã bắt đầu công việc',
        `Thợ đã bắt đầu thực hiện công việc "${task.title}".`,
        'TASK',
        taskId,
      )
      .catch(() => undefined);

    await auditService
      .record({
        userId: staffId,
        action: 'MAINTENANCE_TASK_START',
        entityType: 'MaintenanceTask',
        entityId: taskId,
        metadata: { from: 'ASSIGNED', to: 'IN_PROGRESS' },
      })
      .catch(() => undefined);

    return toTaskPayload({ id: staffId, role: 'STAFF' }, updated);
  },


  /**
   * 🆕 Batch 3 — thợ gửi nghiệm thu (BẮT BUỘC kèm ảnh bằng chứng).
   *
   * - Chỉ thợ ĐƯỢC GIAO mới nộp được; trạng thái nguồn phải là IN_PROGRESS.
   * - Phải có ÍT NHẤT MỘT ảnh nghiệm thu: ghi chú chỉ là mô tả, không thay thế
   *   được bằng chứng hiện trạng sau khi sửa. Server chặn ở đây (không chỉ UI)
   *   để không client nào bỏ qua được quy tắc này.
   * - Ảnh được upload TRƯỚC transaction (dịch vụ ngoài, không thể rollback);
   *   nếu bất kỳ bước nào sau đó thất bại, asset vừa upload bị xoá để không để
   *   lại rác Cloudinary và không có ảnh "mồ côi" trỏ tới công việc.
   * - Lý do từ chối của lần trước (`completionReviewNote`) được GIỮ NGUYÊN khi
   *   nộp lại: thợ và chủ trọ vẫn thấy mốc/lý do cũ cho tới lần duyệt kế tiếp,
   *   và toàn bộ lịch sử nằm trong `audit_logs`.
   */
  submitCompletion: async (
    staffId: string,
    taskId: string,
    input: MaintenanceTaskCompletionInput,
    files: Express.Multer.File[] = [],
  ) => {
    if (files.length > MAX_COMPLETION_IMAGES) {
      throw new AppError(
        `Chỉ được gửi tối đa ${MAX_COMPLETION_IMAGES} ảnh nghiệm thu`,
        400,
        'TOO_MANY_COMPLETION_IMAGES',
      );
    }

    const task = await prisma.maintenanceTask.findFirst({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        landlordId: true,
        status: true,
        assignedStaffId: true,
      },
    });
    if (!task || task.assignedStaffId !== staffId) {
      throw new AppError(
        'Không tìm thấy công việc hoặc công việc không được giao cho bạn',
        404,
        'TASK_NOT_ASSIGNED_TO_YOU',
      );
    }
    if (task.status !== 'IN_PROGRESS') throw blockedSubmit(task.status);

    const note = input.note ?? null;
    if (files.length === 0) {
      throw new AppError(
        'Cần ít nhất một ảnh nghiệm thu để gửi hoàn thành',
        400,
        'COMPLETION_EVIDENCE_REQUIRED',
      );
    }

    const assets = await completionImagesInput(files);
    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.maintenanceTask.updateMany({
          where: { id: taskId, assignedStaffId: staffId, status: 'IN_PROGRESS' },
          data: {
            status: 'SUBMITTED',
            completionSubmittedAt: new Date(),
            completionNote: note,
            // Bộ đếm đơn điệu: nộp trùng bị chặn bởi điều kiện trạng thái ở
            // trên, còn UI hiển thị được "đã làm lại lần thứ N".
            completionAttempts: { increment: 1 },
          },
        });
        if (claimed.count !== 1) {
          throw new AppError(
            'Công việc vừa thay đổi trạng thái, vui lòng tải lại',
            409,
            'COMPLETION_STATE_CONFLICT',
          );
        }

        // KYC đọc lại SAU khi đã giành khoá: thu hồi KYC → rollback cả lần nộp.
        await assertActiveStaffWithKyc(tx, staffId, 'gửi nghiệm thu');

        if (assets.length) {
          await tx.maintenanceTaskImage.createMany({
            data: assets.map((imageUrl) => ({
              taskId,
              imageUrl,
              // Bằng chứng nghiệm thu KHÔNG BAO GIỜ ghi đè ảnh hiện trạng.
              kind: 'COMPLETION' as const,
            })),
          });
        }

        return tx.maintenanceTask.findUniqueOrThrow({ where: { id: taskId }, select: taskDetailSelect });
      });
    } catch (error) {
      await Promise.all(
        assets.map((asset) => storageService.deleteImage(asset, 'authenticated').catch(() => undefined)),
      );
      throw error;
    }

    await notificationService
      .createNotification(
        task.landlordId,
        'Thợ đã gửi nghiệm thu',
        `Thợ đã gửi kết quả công việc "${task.title}". Vui lòng kiểm tra và xác nhận hoàn thành.`,
        'TASK',
        taskId,
      )
      .catch(() => undefined);

    await auditService
      .record({
        userId: staffId,
        action: 'MAINTENANCE_TASK_SUBMIT_COMPLETION',
        entityType: 'MaintenanceTask',
        entityId: taskId,
        metadata: {
          from: 'IN_PROGRESS',
          to: 'SUBMITTED',
          attempt: updated.completionAttempts,
          note,
          images: assets.length,
        },
      })
      .catch(() => undefined);

    return toTaskPayload({ id: staffId, role: 'STAFF' }, updated);
  },


  /**
   * 🆕 Batch 3 — chủ trọ XÁC NHẬN hoàn thành.
   *
   * Chỉ chủ trọ sở hữu công việc (`landlord_id` lấy từ token) duyệt được; công
   * việc của chủ trọ khác trả 404 để không xác nhận sự tồn tại của bản ghi.
   *
   * Sự cố nguồn được đưa về COMPLETED cùng transaction:
   * - Đây là trạng thái DUY NHẤT không mâu thuẫn với công việc đã hoàn thành —
   *   để một sự cố "CANCELLED"/"IN_PROGRESS" trong khi công việc đã COMPLETED
   *   là dữ liệu tự mâu thuẫn (và khách thuê sẽ thấy sai).
   * - Chỉ chủ trọ đó vừa bấm xác nhận, nên việc chuyển sự cố sang COMPLETED là
   *   quyết định của chính người đã huỷ/xử lý nó trước đó.
   * - KHÔNG đụng `triageStatus`/`triageNote` (lịch sử tiếp nhận của khách thuê
   *   và nội dung báo cáo gốc được giữ nguyên).
   */
  confirmCompletion: async (
    landlordId: string,
    taskId: string,
    input: MaintenanceCompletionConfirmInput,
  ) => {
    const task = await prisma.maintenanceTask.findFirst({
      where: { id: taskId, landlordId },
      select: {
        id: true,
        title: true,
        landlordId: true,
        status: true,
        assignedStaffId: true,
        sourceIssueId: true,
      },
    });
    if (!task) {
      throw new AppError('Không tìm thấy công việc hoặc bạn không có quyền', 404, 'TASK_NOT_FOUND');
    }
    if (task.status !== 'SUBMITTED') throw blockedReview(task.status);

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.maintenanceTask.updateMany({
        where: { id: taskId, landlordId, status: 'SUBMITTED' },
        data: {
          status: 'COMPLETED',
          completionReviewedAt: new Date(),
          completionReviewNote: input.note ?? null,
        },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          'Kết quả nghiệm thu vừa được xử lý ở một yêu cầu khác, vui lòng tải lại',
          409,
          'COMPLETION_REVIEW_CONFLICT',
        );
      }

      await tx.maintenanceRequest.updateMany({
        where: { id: task.sourceIssueId, status: { not: 'COMPLETED' } },
        data: { status: 'COMPLETED', resolvedAt: new Date() },
      });

      return tx.maintenanceTask.findUniqueOrThrow({ where: { id: taskId }, select: taskDetailSelect });
    });

    if (task.assignedStaffId) {
      await notificationService
        .createNotification(
          task.assignedStaffId,
          'Công việc đã được xác nhận hoàn thành',
          `Chủ trọ đã xác nhận hoàn thành công việc "${task.title}".`,
          'TASK',
          taskId,
        )
        .catch(() => undefined);
    }

    await auditService
      .record({
        userId: landlordId,
        action: 'MAINTENANCE_TASK_CONFIRM_COMPLETION',
        entityType: 'MaintenanceTask',
        entityId: taskId,
        metadata: {
          from: 'SUBMITTED',
          to: 'COMPLETED',
          note: input.note ?? null,
          staffId: task.assignedStaffId,
        },
      })
      .catch(() => undefined);

    return toTaskPayload({ id: landlordId, role: 'LANDLORD' }, updated);
  },

  /**
   * 🆕 Batch 3 — chủ trọ YÊU CẦU LÀM LẠI (bắt buộc có lý do).
   *
   * - Công việc trở lại IN_PROGRESS để thợ sửa và nộp lại; `startedAt` KHÔNG bị
   *   đặt lại vì công việc chưa từng rời trạng thái đang thực hiện.
   * - `completionSubmittedAt`/ảnh nghiệm thu được GIỮ NGUYÊN (lịch sử làm việc),
   *   lý do ghi vào `completionReviewNote` + audit để lần nộp sau không xoá mất.
   * - Tranh chấp xác nhận/làm lại: cùng `updateMany ... status = 'SUBMITTED'`,
   *   nên chỉ một bên thắng; bên còn lại nhận 409 `COMPLETION_REVIEW_CONFLICT`.
   */
  rejectCompletion: async (
    landlordId: string,
    taskId: string,
    input: MaintenanceCompletionRejectInput,
  ) => {
    const task = await prisma.maintenanceTask.findFirst({
      where: { id: taskId, landlordId },
      select: {
        id: true,
        title: true,
        landlordId: true,
        status: true,
        assignedStaffId: true,
      },
    });
    if (!task) {
      throw new AppError('Không tìm thấy công việc hoặc bạn không có quyền', 404, 'TASK_NOT_FOUND');
    }
    if (task.status !== 'SUBMITTED') throw blockedReview(task.status);

    const reason = input.reason.trim();

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.maintenanceTask.updateMany({
        where: { id: taskId, landlordId, status: 'SUBMITTED' },
        data: {
          status: 'IN_PROGRESS',
          completionReviewedAt: new Date(),
          completionReviewNote: reason,
        },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          'Kết quả nghiệm thu vừa được xử lý ở một yêu cầu khác, vui lòng tải lại',
          409,
          'COMPLETION_REVIEW_CONFLICT',
        );
      }

      return tx.maintenanceTask.findUniqueOrThrow({ where: { id: taskId }, select: taskDetailSelect });
    });

    if (task.assignedStaffId) {
      await notificationService
        .createNotification(
          task.assignedStaffId,
          'Chủ trọ yêu cầu làm lại',
          `Công việc "${task.title}" cần được làm lại. Lý do: ${reason}`,
          'TASK',
          taskId,
        )
        .catch(() => undefined);
    }

    await auditService
      .record({
        userId: landlordId,
        action: 'MAINTENANCE_TASK_REJECT_COMPLETION',
        entityType: 'MaintenanceTask',
        entityId: taskId,
        metadata: {
          from: 'SUBMITTED',
          to: 'IN_PROGRESS',
          reason,
          staffId: task.assignedStaffId,
        },
      })
      .catch(() => undefined);

    return toTaskPayload({ id: landlordId, role: 'LANDLORD' }, updated);
  },
};

