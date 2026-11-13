import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import type { ServiceCategory } from '@prisma/client';
import { assertKycApproved, kycStateOf, loadKycState } from './kycGate.service';
import { notificationService } from './notification.service';
import { applicantSelect, ownApplicationSelect, taskDetailSelect, taskSummarySelect, toTaskPayload } from './maintenanceTask.service';
import type { MaintenanceApplicationCreateInput } from '../validations/maintenanceTask.validation';

/**
 * MARKETPLACE CÔNG VIỆC BẢO TRÌ (Batch 2) — phần "đơn ứng tuyển & giao việc".
 *
 * Ba bất biến được bảo vệ ở đây:
 *
 * 1. KYC: mọi lần ỨNG TUYỂN và mọi lần GIAO VIỆC đều đọc lại trạng thái KYC
 *    TRONG CÙNG transaction với thao tác ghi (`loadKycState(..., tx)` +
 *    `assertKycApproved`). Không dựa vào `req.user`, không dựa vào trạng thái
 *    client đã cache — admin vừa từ chối KYC thì lần ghi kế tiếp phải hỏng.
 *
 * 2. Đúng MỘT thợ cho một công việc: giao việc là một `UPDATE ... WHERE
 *    status = 'OPEN'` có điều kiện. Hai request đồng thời chỉ một cái trả về
 *    `count = 1`; cái còn lại nhận 409 và transaction rollback toàn bộ (kể cả
 *    đơn vừa được chấp nhận). `maintenance_tasks.assigned_application_id` là
 *    UNIQUE nên tầng DB cũng không cho phép hai đơn cùng được chấp nhận.
 *
 * 3. Không trùng đơn: `@@unique([taskId, staffId])` ở DB + kiểm tra `PENDING`
 *    trong transaction.
 *
 * 🆕 Batch 2.1:
 * - (L4) `apply` giữ KHOÁ hàng công việc bằng `UPDATE ... WHERE status='OPEN'`
 *   ngay trước khi ghi đơn, nên không thể tạo đơn PENDING trên công việc vừa
 *   được giao/huỷ ở một request song song.
 * - (L5) `accept` đọc lại TOÀN BỘ điều kiện của thợ (role, isActive, hồ sơ,
 *   trạng thái nhận việc, kỹ năng, KYC) trước khi giành việc: hồ sơ thợ có thể
 *   đã thay đổi trong khoảng thời gian giữa lúc ứng tuyển và lúc giao việc.
 */

/** Kỹ năng mà công việc yêu cầu; rỗng = dùng chính danh mục của công việc. */
const requiredCategories = (task: { category: ServiceCategory; skills: Array<{ category: ServiceCategory }> }) =>
  task.skills.length ? task.skills.map((skill) => skill.category) : [task.category];

export const maintenanceApplicationService = {
  /**
   * Thợ ứng tuyển một công việc đang mở.
   *
   * Kiểm tra theo thứ tự "fail closed": công việc tồn tại & còn OPEN → KYC đã
   * duyệt (đọc trong transaction) → tài khoản còn hoạt động & đúng role STAFF →
   * hồ sơ thợ tồn tại & đang bật nhận việc → kỹ năng khớp → không có đơn đang
   * chờ. Chỉ khi tất cả điều kiện đúng thì mới ghi.
   */
  apply: async (staffId: string, taskId: string, input: MaintenanceApplicationCreateInput = {}) => {
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.maintenanceTask.findFirst({
        where: { id: taskId },
        select: {
          id: true,
          title: true,
          landlordId: true,
          status: true,
          category: true,
          skills: { select: { category: true } },
        },
      });
      if (!task) throw new AppError('Không tìm thấy công việc', 404);
      if (task.status !== 'OPEN') {
        throw new AppError('Công việc không còn mở để ứng tuyển', 409, 'TASK_NOT_OPEN');
      }

      // (1) KYC — cùng transaction với lần ghi bên dưới.
      const kycState = await loadKycState(staffId, tx);
      assertKycApproved(kycState, 'ứng tuyển công việc');

      const staff = await tx.user.findUnique({
        where: { id: staffId },
        select: {
          role: true,
          isActive: true,
          staffProfile: {
            select: { id: true, isAvailable: true, skills: { select: { category: true } } },
          },
        },
      });
      if (!staff || staff.role !== 'STAFF') {
        throw new AppError('Chỉ tài khoản thợ mới được ứng tuyển công việc', 403, 'STAFF_ROLE_REQUIRED');
      }
      if (!staff.isActive) {
        throw new AppError('Tài khoản đã bị khoá nên không thể ứng tuyển', 403, 'ACCOUNT_INACTIVE');
      }
      if (!staff.staffProfile) {
        throw new AppError('Bạn cần hoàn thiện hồ sơ thợ trước khi ứng tuyển', 409, 'STAFF_PROFILE_REQUIRED');
      }
      if (!staff.staffProfile.isAvailable) {
        throw new AppError(
          'Bạn đang tắt trạng thái nhận việc. Bật lại trước khi ứng tuyển.',
          409,
          'STAFF_NOT_AVAILABLE',
        );
      }

      const required = requiredCategories(task);
      if (!staff.staffProfile.skills.some((skill) => required.includes(skill.category))) {
        throw new AppError(
          'Kỹ năng trong hồ sơ của bạn không khớp yêu cầu của công việc này',
          403,
          'STAFF_SKILL_MISMATCH',
        );
      }

      const existing = await tx.maintenanceTaskApplication.findUnique({
        where: { taskId_staffId: { taskId, staffId } },
        select: { id: true, status: true },
      });
      if (existing?.status === 'PENDING') {
        throw new AppError('Bạn đã ứng tuyển công việc này rồi', 409, 'DUPLICATE_APPLICATION');
      }
      if (existing?.status === 'ACCEPTED') {
        throw new AppError('Bạn đã được giao công việc này', 409, 'APPLICATION_ALREADY_ACCEPTED');
      }

      // Đơn cũ ở trạng thái REJECTED/WITHDRAWN được dùng lại (đưa về PENDING)
      // thay vì tạo bản ghi mới: giữ ràng buộc unique và không nhân bản lịch sử.
      //
      // 🆕 Batch 2.1 (L4) — CHỐT LẠI "CÒN OPEN" NGAY TRƯỚC KHI GHI.
      // Kiểm tra `task.status` ở đầu transaction là đọc, không phải chốt: một
      // lệnh `accept` (UPDATE ... WHERE status='OPEN' -> ASSIGNED) có thể commit
      // xen giữa lúc đọc và lúc insert, để lại đơn PENDING trên công việc đã
      // giao. Câu UPDATE dưới đây giữ KHOÁ HÀNG của `maintenance_tasks` tới hết
      // transaction và đánh giá lại điều kiện trên phiên bản mới nhất:
      // - accept/cancel chạy trước -> status không còn OPEN -> count = 0 -> 409,
      //   KHÔNG ghi đơn;
      // - apply chạy trước -> accept/cancel phải chờ, rồi khi chạy sẽ thấy đơn
      //   PENDING và từ chối nó trong cùng transaction của chúng.
      // `data.status = 'OPEN'` là ghi lại đúng giá trị (mục đích là giữ khoá và
      // kiểm tra lại điều kiện), nên không tạo thêm trạng thái nào cho công việc.
      const stillOpen = await tx.maintenanceTask.updateMany({
        where: { id: taskId, status: 'OPEN' },
        data: { status: 'OPEN' },
      });
      if (stillOpen.count !== 1) {
        throw new AppError('Công việc vừa được giao hoặc bị huỷ, không thể ứng tuyển', 409, 'TASK_NOT_OPEN');
      }

      const application = existing
        ? await tx.maintenanceTaskApplication.update({
            where: { id: existing.id },
            data: {
              status: 'PENDING',
              message: input.message ?? null,
              proposedAmount: input.proposedAmount ?? null,
              reviewedAt: null,
            },
            select: ownApplicationSelect,
          })
        : await tx.maintenanceTaskApplication.create({
            data: {
              taskId,
              staffId,
              message: input.message ?? null,
              proposedAmount: input.proposedAmount ?? null,
            },
            select: ownApplicationSelect,
          });

      return { application, task };
    });

    // Thông báo phát SAU commit để không bao giờ báo một đơn đã bị rollback.
    // Lỗi thông báo không được phép làm hỏng đơn đã ghi thành công.
    await notificationService
      .createNotification(
        result.task.landlordId,
        'Có thợ ứng tuyển công việc',
        `Công việc "${result.task.title}" vừa nhận một đơn ứng tuyển mới.`,
        'TASK',
        result.task.id,
      )
      .catch(() => undefined);

    return result.application;
  },

  /**
   * Thợ tự rút đơn khi còn chờ duyệt. Đơn đã được chấp nhận (hoặc công việc đã
   * giao) KHÔNG rút được trong Batch 2 — huỷ giao việc là nghiệp vụ của Batch 3.
   *
   * UPDATE có điều kiện `status = PENDING` để không đè lên kết quả chủ trọ vừa
   * chấp nhận ở một request song song.
   */
  withdraw: async (staffId: string, taskId: string) => {
    const application = await prisma.maintenanceTaskApplication.findUnique({
      where: { taskId_staffId: { taskId, staffId } },
      select: {
        id: true,
        status: true,
        task: { select: { id: true, title: true, landlordId: true, status: true } },
      },
    });
    if (!application) throw new AppError('Bạn chưa ứng tuyển công việc này', 404);
    if (application.status === 'ACCEPTED' || application.task.status === 'ASSIGNED') {
      throw new AppError('Công việc đã được giao nên không thể rút đơn', 409, 'APPLICATION_LOCKED');
    }
    if (application.status !== 'PENDING') {
      throw new AppError('Đơn ứng tuyển không còn ở trạng thái chờ duyệt', 409, 'APPLICATION_NOT_PENDING');
    }

    const withdrawn = await prisma.maintenanceTaskApplication.updateMany({
      where: { id: application.id, status: 'PENDING' },
      data: { status: 'WITHDRAWN', reviewedAt: new Date() },
    });
    if (withdrawn.count !== 1) {
      throw new AppError('Đơn ứng tuyển vừa thay đổi trạng thái, vui lòng tải lại', 409, 'APPLICATION_STATE_CONFLICT');
    }

    const updated = await prisma.maintenanceTaskApplication.findUniqueOrThrow({
      where: { id: application.id },
      select: ownApplicationSelect,
    });
    await notificationService
      .createNotification(
        application.task.landlordId,
        'Thợ đã rút đơn ứng tuyển',
        `Một thợ vừa rút đơn ứng tuyển công việc "${application.task.title}".`,
        'TASK',
        taskId,
      )
      .catch(() => undefined);
    return updated;
  },

  /** Đơn ứng tuyển của CHÍNH thợ, kèm tóm tắt công việc. */
  listMine: (staffId: string) =>
    prisma.maintenanceTaskApplication.findMany({
      where: { staffId },
      select: { ...ownApplicationSelect, task: { select: taskSummarySelect } },
      orderBy: [{ createdAt: 'desc' }],
    }),

  /**
   * Chủ trọ xem đơn của công việc MÌNH SỞ HỮU. Sai chủ sở hữu trả 404 (không
   * phải 403) để không xác nhận sự tồn tại của công việc/đơn cho người lạ.
   */
  listForTask: async (landlordId: string, taskId: string) => {
    const task = await prisma.maintenanceTask.findFirst({
      where: { id: taskId, landlordId },
      select: { id: true },
    });
    if (!task) throw new AppError('Không tìm thấy công việc hoặc bạn không có quyền', 404);

    const applications = await prisma.maintenanceTaskApplication.findMany({
      where: { taskId },
      select: applicantSelect,
      orderBy: [{ createdAt: 'asc' }],
    });
    return applications.map(({ staff: { kycSubmission, ...staff }, ...application }) => ({
      ...application,
      staff,
      kycStatus: kycStateOf(kycSubmission),
    }));
  },


  /**
   * Chủ trọ chấp nhận ĐÚNG MỘT đơn và giao việc — thao tác nguyên tử.
   *
   * Thứ tự trong transaction:
   * 1. xác minh chủ sở hữu + công việc còn OPEN (đọc);
   * 2. xác minh đơn còn PENDING (đọc);
   * 3. đọc lại KYC + trạng thái tài khoản thợ (đọc, cùng transaction);
   * 4. `UPDATE ... WHERE status = 'OPEN'` để GIÀNH công việc — đây là điểm chốt
   *    duy nhất của cuộc đua: request thứ hai nhận `count = 0` và rollback;
   * 5. `UPDATE ... WHERE status = 'PENDING'` cho đơn được chọn;
   * 6. từ chối các đơn PENDING còn lại (giữ nguyên lịch sử, không xoá).
   */
  accept: async (landlordId: string, taskId: string, applicationId: string) => {
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.maintenanceTask.findFirst({
        where: { id: taskId },
        select: {
          id: true,
          landlordId: true,
          status: true,
          title: true,
          assignedApplicationId: true,
          // 🆕 Batch 2.1 (L5): yêu cầu kỹ năng của công việc để đối chiếu với hồ
          // sơ thợ TẠI THỜI ĐIỂM GIAO VIỆC.
          category: true,
          skills: { select: { category: true } },
        },
      });
      if (!task || task.landlordId !== landlordId) {
        throw new AppError('Không tìm thấy công việc hoặc bạn không có quyền', 404);
      }
      if (task.status !== 'OPEN') {
        throw new AppError('Công việc không còn mở để giao thợ', 409, 'TASK_NOT_OPEN');
      }

      const application = await tx.maintenanceTaskApplication.findFirst({
        where: { id: applicationId, taskId },
        select: { id: true, staffId: true, status: true, proposedAmount: true },
      });
      if (!application) throw new AppError('Không tìm thấy đơn ứng tuyển của công việc này', 404);
      if (application.status !== 'PENDING') {
        throw new AppError('Đơn ứng tuyển đã được xử lý', 409, 'APPLICATION_ALREADY_REVIEWED');
      }

      // KYC được đọc LẠI tại đây: thợ có thể đã bị admin từ chối KYC sau lúc
      // ứng tuyển, nên trạng thái lúc ứng tuyển không được dùng lại.
      const kycState = await loadKycState(application.staffId, tx);
      /**
       * 🆕 Batch 2.1 (L5) — ĐỌC LẠI TOÀN BỘ ĐIỀU KIỆN CỦA THỢ.
       *
       * Thợ có thể ứng tuyển khi đang "bật nhận việc" và có kỹ năng phù hợp, rồi
       * tắt nhận việc hoặc xoá kỹ năng trước khi chủ trọ bấm giao việc. Trước
       * Batch 2.1 chỉ kiểm tra role/isActive/KYC, nên chủ trọ vẫn giao được việc
       * cho một thợ đã tắt nhận việc / không còn kỹ năng — đúng thứ mà bộ lọc
       * marketplace hứa với họ.
       *
       * Tất cả đọc trong CÙNG transaction với UPDATE giành việc bên dưới, và mọi
       * kiểm tra đều hỏng TRƯỚC khi ghi: không có cập nhật dở dang.
       */
      const staff = await tx.user.findUnique({
        where: { id: application.staffId },
        select: {
          role: true,
          isActive: true,
          staffProfile: {
            select: { id: true, isAvailable: true, skills: { select: { category: true } } },
          },
        },
      });
      if (!staff || staff.role !== 'STAFF' || !staff.isActive) {
        throw new AppError('Tài khoản thợ không còn hoạt động', 409, 'STAFF_NOT_ELIGIBLE');
      }
      if (!staff.staffProfile) {
        throw new AppError('Thợ chưa có hồ sơ nên không thể nhận việc', 409, 'STAFF_PROFILE_REQUIRED');
      }
      if (!staff.staffProfile.isAvailable) {
        throw new AppError(
          'Thợ đã tắt trạng thái nhận việc nên không thể giao việc này',
          409,
          'STAFF_NOT_AVAILABLE',
        );
      }
      // Kỹ năng đối chiếu theo ĐÚNG quy tắc của lúc ứng tuyển
      // (`requiredCategories`: rỗng thì dùng danh mục của công việc).
      const required = requiredCategories(task);
      if (!staff.staffProfile.skills.some((skill) => required.includes(skill.category))) {
        throw new AppError(
          'Kỹ năng hiện tại của thợ không còn khớp yêu cầu công việc',
          409,
          'STAFF_SKILL_MISMATCH',
        );
      }
      assertKycApproved(kycState, 'được giao việc');

      const claimed = await tx.maintenanceTask.updateMany({
        where: { id: taskId, landlordId, status: 'OPEN' },
        data: {
          status: 'ASSIGNED',
          assignedStaffId: application.staffId,
          assignedApplicationId: application.id,
          assignedAt: new Date(),
          // 🆕 Batch 3 — chấp nhận đơn có giá thợ đề nghị = hai bên đã thoả thuận
          // giá đó, nên ghi luôn `agreedAmount`. Đơn không kèm giá thì để NULL và
          // hai bên phải thương lượng trước khi thợ được bắt đầu.
          ...(application.proposedAmount != null
            ? { agreedAmount: application.proposedAmount, agreedAt: new Date(), negotiationVersion: { increment: 1 } }
            : {}),
        },
      });
      if (claimed.count !== 1) {
        throw new AppError('Công việc vừa được giao cho thợ khác, vui lòng tải lại', 409, 'TASK_ALREADY_ASSIGNED');
      }

      const accepted = await tx.maintenanceTaskApplication.updateMany({
        where: { id: application.id, status: 'PENDING' },
        data: { status: 'ACCEPTED', reviewedAt: new Date() },
      });
      if (accepted.count !== 1) {
        throw new AppError('Đơn ứng tuyển vừa thay đổi trạng thái, vui lòng tải lại', 409, 'APPLICATION_STATE_CONFLICT');
      }

      const others = await tx.maintenanceTaskApplication.findMany({
        where: { taskId, id: { not: application.id }, status: 'PENDING' },
        select: { staffId: true },
      });
      if (others.length) {
        await tx.maintenanceTaskApplication.updateMany({
          where: { taskId, id: { not: application.id }, status: 'PENDING' },
          data: { status: 'REJECTED', reviewedAt: new Date() },
        });
      }

      const updatedTask = await tx.maintenanceTask.findUniqueOrThrow({
        where: { id: taskId },
        select: taskDetailSelect,
      });
      return {
        task: updatedTask,
        acceptedStaffId: application.staffId,
        rejectedStaffIds: others.map((other) => other.staffId),
      };
    });


    await Promise.all([
      notificationService
        .createNotification(
          result.acceptedStaffId,
          'Đơn ứng tuyển được chấp nhận',
          `Chủ trọ đã giao công việc "${result.task.title}" cho bạn.`,
          'TASK',
          taskId,
        )
        .catch(() => undefined),
      // Bản ghi cho chủ trọ: dấu vết "đã giao việc" nằm trong chính hộp thông báo
      // của họ, không phải chỉ ở log.
      notificationService
        .createNotification(
          landlordId,
          'Đã giao việc cho thợ',
          `Công việc "${result.task.title}" đã được giao cho thợ.`,
          'TASK',
          taskId,
        )
        .catch(() => undefined),
      ...result.rejectedStaffIds.map((staffId) =>
        notificationService
          .createNotification(
            staffId,
            'Đơn ứng tuyển bị từ chối',
            `Chủ trọ đã chọn thợ khác cho công việc "${result.task.title}".`,
            'TASK',
            taskId,
          )
          .catch(() => undefined),
      ),
    ]);

    // 🆕 Batch 2.1 (M2): chủ trọ (người vừa giao việc) nhận đường dẫn ảnh có token.
    return toTaskPayload({ id: landlordId, role: 'LANDLORD' }, result.task);
  },

  /** Chủ trọ từ chối một đơn còn chờ duyệt của công việc mình sở hữu. */
  reject: async (landlordId: string, taskId: string, applicationId: string) => {
    const task = await prisma.maintenanceTask.findFirst({
      where: { id: taskId },
      select: { id: true, landlordId: true, status: true, title: true },
    });
    if (!task || task.landlordId !== landlordId) {
      throw new AppError('Không tìm thấy công việc hoặc bạn không có quyền', 404);
    }
    if (task.status !== 'OPEN') {
      throw new AppError('Công việc không còn mở để xử lý đơn', 409, 'TASK_NOT_OPEN');
    }

    const application = await prisma.maintenanceTaskApplication.findFirst({
      where: { id: applicationId, taskId },
      select: { id: true, staffId: true, status: true },
    });
    if (!application) throw new AppError('Không tìm thấy đơn ứng tuyển của công việc này', 404);
    if (application.status !== 'PENDING') {
      throw new AppError('Đơn ứng tuyển đã được xử lý', 409, 'APPLICATION_ALREADY_REVIEWED');
    }

    const rejected = await prisma.maintenanceTaskApplication.updateMany({
      where: { id: application.id, taskId, status: 'PENDING' },
      data: { status: 'REJECTED', reviewedAt: new Date() },
    });
    if (rejected.count !== 1) {
      throw new AppError('Đơn ứng tuyển vừa thay đổi trạng thái, vui lòng tải lại', 409, 'APPLICATION_STATE_CONFLICT');
    }

    await notificationService
      .createNotification(
        application.staffId,
        'Đơn ứng tuyển bị từ chối',
        `Chủ trọ đã từ chối đơn ứng tuyển công việc "${task.title}".`,
        'TASK',
        taskId,
      )
      .catch(() => undefined);

    return { id: application.id, taskId, staffId: application.staffId, status: 'REJECTED' as const };
  },
};

