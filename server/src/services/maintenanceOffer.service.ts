import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import type { MaintenanceOfferActor, MaintenanceTaskStatus, Prisma } from '@prisma/client';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';
import { minorToDecimalString, toMinorUnits } from '../utils/money';
import type {
  MaintenanceOfferDecisionInput,
  MaintenanceOfferProposeInput,
} from '../validations/maintenanceOffer.validation';

/**
 * THƯƠNG LƯỢNG GIÁ (Batch 3).
 *
 * Luật nghiệp vụ:
 * - Hai bên (chủ trọ sở hữu công việc và thợ ĐƯỢC GIAO) đề xuất / phản đề xuất
 *   giá; mỗi đề xuất là một dòng BẤT BIẾN trong `maintenance_task_offers`.
 * - Chỉ khi bên CÒN LẠI chấp nhận thì `maintenance_tasks.agreed_amount` mới đổi.
 *   Không có endpoint nào ghi thẳng `agreed_amount` từ body.
 * - Giá đã chốt không bị sửa ngầm: từ chối một phản đề xuất KHÔNG làm mất giá đã
 *   chốt trước đó; muốn đổi giá phải có đề xuất mới + chấp nhận của bên kia.
 * - Thợ chỉ được bắt đầu khi đã có `agreed_amount` (xem `maintenanceWorkflow`).
 *
 * Chống request cũ / chạy song song:
 * - Mỗi quyết định là một CAS trên `negotiation_version` của công việc, cộng một
 *   CAS trên `status = 'PENDING'` của đề xuất. Hai request đồng thời chỉ một cái
 *   `count = 1`; cái còn lại nhận 409 và không ghi gì.
 * - `expectedVersion` (tuỳ chọn) cho phép client từ chối áp quyết định lên một
 *   trạng thái thương lượng đã cũ hơn cái nó đang hiển thị.
 */

/** Chỉ hai trạng thái này mới còn thương lượng: đã có thợ và chưa gửi nghiệm thu. */
export const NEGOTIABLE_TASK_STATUSES: MaintenanceTaskStatus[] = ['ASSIGNED', 'IN_PROGRESS'];

const OFFER_STATUS_BLOCKED: Record<string, AppError> = {
  SUBMITTED: new AppError('Công việc đã gửi nghiệm thu nên không thể đổi giá', 409, 'PRICE_LOCKED'),
  COMPLETED: new AppError('Công việc đã hoàn thành nên không thể đổi giá', 409, 'TASK_COMPLETED'),
  CANCELLED: new AppError('Công việc đã bị huỷ nên không thể thương lượng', 409, 'TASK_CANCELLED'),
  OPEN: new AppError('Công việc chưa được giao cho thợ nên chưa có giá để thương lượng', 409, 'TASK_NOT_ASSIGNED'),
};

const assertNegotiable = (status: MaintenanceTaskStatus) => {
  if (NEGOTIABLE_TASK_STATUSES.includes(status)) return;
  throw OFFER_STATUS_BLOCKED[status] ?? new AppError('Không thể thương lượng ở trạng thái này', 409, 'TASK_NOT_NEGOTIABLE');
};

type TaskRow = {
  id: string;
  status: MaintenanceTaskStatus;
  landlordId: string;
  assignedStaffId: string | null;
  agreedAmount: Prisma.Decimal | null;
  agreedAt: Date | null;
  negotiationVersion: number;
  title: string;
};

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Xác định vai trò của người gọi TỪ QUAN HỆ trong DB (không tin role trong token:
 * một tài khoản có thể là chủ trọ của công việc này và là thợ của công việc
 * khác). Không phải người tham gia -> 404 để không lộ sự tồn tại của công việc.
 */
const loadParticipant = async (db: Db, actorId: string, taskId: string) => {
  const task = await db.maintenanceTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      landlordId: true,
      assignedStaffId: true,
      agreedAmount: true,
      agreedAt: true,
      negotiationVersion: true,
      title: true,
    },
  });
  if (!task) throw new AppError('Không tìm thấy công việc', 404);

  const actorRole: MaintenanceOfferActor | null =
    task.landlordId === actorId ? 'LANDLORD' : task.assignedStaffId === actorId ? 'STAFF' : null;
  if (!actorRole) throw new AppError('Không tìm thấy công việc', 404);

  return { task: task as TaskRow, actorRole };
};

const offerSummarySelect = {
  id: true,
  taskId: true,
  version: true,
  proposedById: true,
  proposedByRole: true,
  amount: true,
  note: true,
  status: true,
  respondedById: true,
  respondedAt: true,
  responseNote: true,
  createdAt: true,
  proposedBy: { select: { id: true, fullName: true, avatarUrl: true } },
} as const;

const moneyString = (value: number): string => {
  const minor = toMinorUnits(value);
  if (minor === null) throw new AppError('Số tiền không hợp lệ', 400, 'OFFER_AMOUNT_INVALID');
  return minorToDecimalString(minor);
};

const counterpartOf = (task: TaskRow, actorRole: MaintenanceOfferActor) =>
  actorRole === 'LANDLORD' ? task.assignedStaffId : task.landlordId;

const negotiationPayload = async (actorId: string, task: TaskRow, actorRole: MaintenanceOfferActor) => {
  const offers = await prisma.maintenanceTaskOffer.findMany({
    where: { taskId: task.id },
    select: offerSummarySelect,
    orderBy: { version: 'desc' },
  });
  const pending = offers.find((offer) => offer.status === 'PENDING') ?? null;
  return {
    taskId: task.id,
    status: task.status,
    agreedAmount: task.agreedAmount ? task.agreedAmount.toString() : null,
    agreedAt: task.agreedAt,
    negotiationVersion: task.negotiationVersion,
    actorRole,
    canNegotiate: NEGOTIABLE_TASK_STATUSES.includes(task.status),
    // Người ĐỀ XUẤT không thể tự chấp nhận, nên UI dựa vào `canRespond`.
    pendingOffer: pending
      ? {
          id: pending.id,
          amount: pending.amount.toString(),
          proposedById: pending.proposedById,
          proposedByRole: pending.proposedByRole,
          createdAt: pending.createdAt,
          note: pending.note,
          canRespond: pending.proposedById !== actorId,
        }
      : null,
    offers: offers.map((offer) => ({ ...offer, amount: offer.amount.toString() })),
  };
};

export const maintenanceOfferService = {
  /** Lịch sử thương lượng + trạng thái hiện tại. Chỉ người tham gia đọc được. */
  list: async (actorId: string, taskId: string) => {
    const { task, actorRole } = await loadParticipant(prisma, actorId, taskId);
    return negotiationPayload(actorId, task, actorRole);
  },

  /** Đề xuất / phản đề xuất giá. Đề xuất PENDING cũ của cả hai bên thành SUPERSEDED. */
  propose: async (actorId: string, taskId: string, input: MaintenanceOfferProposeInput) => {
    const result = await prisma.$transaction(async (tx) => {
      const { task, actorRole } = await loadParticipant(tx, actorId, taskId);
      assertNegotiable(task.status);

      // Khoá hàng công việc bằng CAS trên đúng version vừa đọc.
      const locked = await tx.maintenanceTask.updateMany({
        where: {
          id: task.id,
          status: { in: NEGOTIABLE_TASK_STATUSES },
          negotiationVersion: task.negotiationVersion,
        },
        data: { negotiationVersion: { increment: 1 } },
      });
      if (locked.count !== 1) {
        throw new AppError('Trạng thái thương lượng vừa thay đổi, vui lòng tải lại', 409, 'NEGOTIATION_CONFLICT');
      }

      await tx.maintenanceTaskOffer.updateMany({
        where: { taskId: task.id, status: 'PENDING' },
        data: { status: 'SUPERSEDED' },
      });

      const offer = await tx.maintenanceTaskOffer.create({
        data: {
          taskId: task.id,
          version: task.negotiationVersion + 1,
          proposedById: actorId,
          proposedByRole: actorRole,
          amount: moneyString(input.amount),
          note: input.note ?? null,
        },
        select: offerSummarySelect,
      });

      return {
        task: { ...task, negotiationVersion: task.negotiationVersion + 1 },
        actorRole,
        offer,
        recipientId: counterpartOf(task, actorRole),
      };
    });

    const amountText = `${Number(result.offer.amount).toLocaleString('vi-VN')} đ`;
    await notificationService
      .notifyUsers(
        result.recipientId ? [result.recipientId] : [],
        {
          title: 'Đề xuất giá mới',
          content:
            result.actorRole === 'LANDLORD'
              ? `Chủ trọ đề xuất ${amountText} cho công việc "${result.task.title}".`
              : `Thợ đề xuất ${amountText} cho công việc "${result.task.title}".`,
          type: 'OFFER',
          referenceId: taskId,
        },
        () => `offer:${result.offer.id}:proposed`,
      )
      .catch(() => undefined);

    await auditService
      .record({
        userId: actorId,
        action: 'MAINTENANCE_OFFER_PROPOSED',
        entityType: 'MaintenanceTask',
        entityId: taskId,
        metadata: { offerId: result.offer.id, amount: result.offer.amount.toString(), version: result.offer.version },
      })
      .catch(() => undefined);

    return negotiationPayload(actorId, result.task, result.actorRole);
  },


  /** Chấp nhận / từ chối đề xuất đang PENDING của BÊN KIA. */
  respond: async (
    actorId: string,
    taskId: string,
    offerId: string,
    decision: 'ACCEPT' | 'REJECT',
    input: MaintenanceOfferDecisionInput = {},
  ) => {
    const result = await prisma.$transaction(async (tx) => {
      const { task, actorRole } = await loadParticipant(tx, actorId, taskId);
      assertNegotiable(task.status);

      if (input.expectedVersion != null && input.expectedVersion !== task.negotiationVersion) {
        throw new AppError(
          'Đã có thay đổi thương lượng mới hơn, vui lòng tải lại trước khi quyết định',
          409,
          'NEGOTIATION_VERSION_CONFLICT',
        );
      }

      const offer = await tx.maintenanceTaskOffer.findFirst({
        where: { id: offerId, taskId: task.id },
        select: { id: true, amount: true, status: true, proposedById: true, version: true },
      });
      if (!offer) throw new AppError('Không tìm thấy đề xuất giá', 404, 'OFFER_NOT_FOUND');
      if (offer.status !== 'PENDING') {
        throw new AppError('Đề xuất này không còn chờ phản hồi', 409, 'OFFER_NOT_PENDING');
      }
      if (offer.proposedById === actorId) {
        throw new AppError('Bạn không thể tự chấp nhận/từ chối đề xuất của chính mình', 403, 'OFFER_SELF_RESPONSE');
      }

      const claimed = await tx.maintenanceTaskOffer.updateMany({
        where: { id: offer.id, taskId: task.id, status: 'PENDING' },
        data: {
          status: decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
          respondedById: actorId,
          respondedAt: new Date(),
          responseNote: input.note ?? null,
        },
      });
      if (claimed.count !== 1) {
        throw new AppError('Đề xuất vừa được xử lý ở nơi khác, vui lòng tải lại', 409, 'OFFER_STATE_CONFLICT');
      }

      const decidedAt = new Date();
      const taskUpdate = await tx.maintenanceTask.updateMany({
        where: {
          id: task.id,
          status: { in: NEGOTIABLE_TASK_STATUSES },
          negotiationVersion: task.negotiationVersion,
        },
        data:
          decision === 'ACCEPT'
            ? { agreedAmount: offer.amount, agreedAt: decidedAt, negotiationVersion: { increment: 1 } }
            : { negotiationVersion: { increment: 1 } },
      });
      if (taskUpdate.count !== 1) {
        throw new AppError('Trạng thái thương lượng vừa thay đổi, vui lòng tải lại', 409, 'NEGOTIATION_CONFLICT');
      }

      if (decision === 'ACCEPT') {
        // Giá đã chốt -> các đề xuất còn chờ khác không còn ý nghĩa.
        await tx.maintenanceTaskOffer.updateMany({
          where: { taskId: task.id, status: 'PENDING' },
          data: { status: 'SUPERSEDED' },
        });
      }

      return {
        task: {
          ...task,
          negotiationVersion: task.negotiationVersion + 1,
          agreedAmount: decision === 'ACCEPT' ? offer.amount : task.agreedAmount,
          agreedAt: decision === 'ACCEPT' ? decidedAt : task.agreedAt,
        },
        actorRole,
        offerId: offer.id,
        amount: offer.amount.toString(),
        recipientId: offer.proposedById,
        decision,
      };
    });

    const amountText = `${Number(result.amount).toLocaleString('vi-VN')} đ`;
    await notificationService
      .notifyUsers(
        [result.recipientId],
        {
          title: result.decision === 'ACCEPT' ? 'Đề xuất giá được chấp nhận' : 'Đề xuất giá bị từ chối',
          content:
            result.decision === 'ACCEPT'
              ? `Giá ${amountText} cho công việc "${result.task.title}" đã được chấp nhận.`
              : `Đề xuất ${amountText} cho công việc "${result.task.title}" đã bị từ chối.`,
          type: 'OFFER',
          referenceId: taskId,
        },
        () => `offer:${result.offerId}:${result.decision}`,
      )
      .catch(() => undefined);

    await auditService
      .record({
        userId: actorId,
        action: result.decision === 'ACCEPT' ? 'MAINTENANCE_OFFER_ACCEPTED' : 'MAINTENANCE_OFFER_REJECTED',
        entityType: 'MaintenanceTask',
        entityId: taskId,
        metadata: { offerId: result.offerId, amount: result.amount },
      })
      .catch(() => undefined);

    return negotiationPayload(actorId, result.task, result.actorRole);
  },


  /** Rút đề xuất CỦA CHÍNH MÌNH khi bên kia chưa phản hồi. */
  withdraw: async (actorId: string, taskId: string, offerId: string, input: MaintenanceOfferDecisionInput = {}) => {
    const result = await prisma.$transaction(async (tx) => {
      const { task, actorRole } = await loadParticipant(tx, actorId, taskId);
      assertNegotiable(task.status);

      if (input.expectedVersion != null && input.expectedVersion !== task.negotiationVersion) {
        throw new AppError('Đã có thay đổi thương lượng mới hơn, vui lòng tải lại', 409, 'NEGOTIATION_VERSION_CONFLICT');
      }

      const offer = await tx.maintenanceTaskOffer.findFirst({
        where: { id: offerId, taskId: task.id },
        select: { id: true, status: true, proposedById: true },
      });
      if (!offer) throw new AppError('Không tìm thấy đề xuất giá', 404, 'OFFER_NOT_FOUND');
      if (offer.proposedById !== actorId) {
        throw new AppError('Chỉ người đề xuất mới được rút đề xuất này', 403, 'OFFER_NOT_OWNER');
      }
      if (offer.status !== 'PENDING') {
        throw new AppError('Đề xuất này không còn chờ phản hồi', 409, 'OFFER_NOT_PENDING');
      }

      const claimed = await tx.maintenanceTaskOffer.updateMany({
        where: { id: offer.id, taskId: task.id, status: 'PENDING', proposedById: actorId },
        data: { status: 'WITHDRAWN', respondedById: actorId, respondedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new AppError('Đề xuất vừa được xử lý ở nơi khác, vui lòng tải lại', 409, 'OFFER_STATE_CONFLICT');
      }

      const taskUpdate = await tx.maintenanceTask.updateMany({
        where: {
          id: task.id,
          status: { in: NEGOTIABLE_TASK_STATUSES },
          negotiationVersion: task.negotiationVersion,
        },
        data: { negotiationVersion: { increment: 1 } },
      });
      if (taskUpdate.count !== 1) {
        throw new AppError('Trạng thái thương lượng vừa thay đổi, vui lòng tải lại', 409, 'NEGOTIATION_CONFLICT');
      }

      return { task: { ...task, negotiationVersion: task.negotiationVersion + 1 }, actorRole };
    });

    return negotiationPayload(actorId, result.task, result.actorRole);
  },
};
