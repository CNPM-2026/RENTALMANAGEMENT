import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import type { DisputeCategory } from '@prisma/client';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';
import { storageService } from './storage.service';
import { mintReportAttachmentUrl } from './reportAttachment.service';

/**
 * BÁO CÁO / TRANH CHẤP (Batch 4).
 *
 * Quy tắc:
 * - Người gửi phải có QUAN HỆ với đối tượng: công việc thì phải là người tham
 *   gia (chủ trọ, thợ được giao) hoặc khách thuê của sự cố nguồn; USER/POST/ROOM
 *   giữ luật cũ. `targetId`/`taskId` do client gửi nhưng luôn được đối chiếu.
 * - Bằng chứng upload PRIVATE; DB lưu `public_id`; người xem hợp lệ là người báo
 *   cáo và admin (`reportAttachment.service`).
 * - Admin xử lý bằng CAS trên trạng thái hiện tại (hai admin bấm cùng lúc chỉ một
 *   người thắng). Kết luận (`resolution`) bắt buộc khi RESOLVED/REJECTED.
 * - KHÔNG tự động khoá tài khoản bị báo cáo: hình phạt là quyết định riêng của
 *   admin qua API quản trị người dùng, và mọi thay đổi đều vào audit log.
 */

export const DISPUTE_STATUSES = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

const TERMINAL_STATUSES: DisputeStatus[] = ['RESOLVED', 'REJECTED'];
const ATTACHMENT_FOLDER = 'rental-management/disputes';
const MAX_ATTACHMENTS = 5;

type ReporterRole = 'TENANT' | 'LANDLORD' | 'STAFF' | 'ADMIN' | string;

const isTerminal = (status: string): boolean => TERMINAL_STATUSES.includes(status as DisputeStatus);

const mintFor = (attachments: Array<{ id: string }>, viewer: { id: string; role: string }) =>
  attachments.map((attachment) => ({
    id: attachment.id,
    url: mintReportAttachmentUrl(attachment.id, viewer),
  }));

/** Tải bằng chứng riêng tư; dọn asset đã lên nếu một tệp giữa chừng thất bại. */
const uploadAttachments = async (files: Express.Multer.File[]) => {
  if (!files.length) return [];
  const uploaded: Array<{ fileRef: string; mimeType: string; byteSize: number }> = [];
  try {
    for (const file of files.slice(0, MAX_ATTACHMENTS)) {
      const fileRef = await storageService.uploadPrivateImage(file, ATTACHMENT_FOLDER);
      uploaded.push({ fileRef, mimeType: file.mimetype, byteSize: file.size });
    }
    return uploaded;
  } catch (error) {
    await Promise.all(
      uploaded.map((item) => storageService.deleteImage(item.fileRef, 'authenticated').catch(() => undefined)),
    );
    throw error;
  }
};

const assertReporterCanReportTask = async (reporterId: string, taskId: string) => {
  const task = await prisma.maintenanceTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      landlordId: true,
      assignedStaffId: true,
      sourceIssue: { select: { tenantId: true } },
    },
  });
  if (!task) throw new AppError('Không tìm thấy công việc', 404);

  const allowed =
    task.landlordId === reporterId ||
    task.assignedStaffId === reporterId ||
    task.sourceIssue?.tenantId === reporterId;
  if (!allowed) throw new AppError('Bạn không phải người tham gia công việc này', 403, 'DISPUTE_FORBIDDEN');
  return task;
};

export const reportService = {
  createReport: async (
    reporterId: string,
    reporterRole: ReporterRole,
    input: {
      targetType: string;
      targetId: string;
      category?: DisputeCategory;
      reason: string;
      taskId?: string;
    },
    files: Express.Multer.File[] = [],
  ) => {
    const { targetType, targetId, reason } = input;
    const category = input.category ?? 'OTHER';
    let taskId = input.taskId ?? null;

    if (targetType === 'TASK') {
      taskId = targetId;
      await assertReporterCanReportTask(reporterId, targetId);
    } else if (taskId) {
      // Báo cáo một NGƯỜI trong ngữ cảnh công việc: người báo phải là người tham
      // gia, và người bị báo phải là bên còn lại của công việc đó.
      const task = await assertReporterCanReportTask(reporterId, taskId);
      const counterpart = task.landlordId === reporterId ? task.assignedStaffId : task.landlordId;
      if (counterpart !== targetId) {
        throw new AppError('Người bị báo cáo không phải bên còn lại của công việc này', 400, 'DISPUTE_TARGET_MISMATCH');
      }
    } else {
      const targetExists =
        targetType === 'POST'
          ? await prisma.post.findUnique({ where: { id: targetId }, select: { id: true } })
          : targetType === 'ROOM'
            ? await prisma.room.findUnique({ where: { id: targetId }, select: { id: true } })
            : await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!targetExists) throw new AppError('Đối tượng báo cáo không tồn tại', 404);
      if (targetType === 'USER' && targetId === reporterId) {
        throw new AppError('Bạn không thể tự báo cáo chính mình', 400, 'SELF_REPORT');
      }
    }

    const uploaded = await uploadAttachments(files);

    let report;
    try {
      report = await prisma.report.create({
        data: {
          reporterId,
          targetType,
          targetId,
          category,
          taskId,
          reason,
          status: 'PENDING',
          ...(uploaded.length ? { attachments: { create: uploaded.map((item) => ({ ...item })) } } : {}),
        },
        include: { attachments: { select: { id: true } } },
      });
    } catch (error) {
      await Promise.all(
        uploaded.map((item) => storageService.deleteImage(item.fileRef, 'authenticated').catch(() => undefined)),
      );
      throw error;
    }

    // Admin là người xử lý; KHÔNG thông báo cho người bị báo cáo (tránh lộ danh
    // tính người tố giác trước khi có kết luận).
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    await notificationService
      .notifyUsers(
        admins.map((admin) => admin.id),
        {
          title: 'Có báo cáo / tranh chấp mới',
          content: `Một ${
            reporterRole === 'STAFF' ? 'thợ' : reporterRole === 'LANDLORD' ? 'chủ trọ' : 'người thuê'
          } vừa gửi báo cáo cần xử lý.`,
          type: 'DISPUTE',
          referenceId: report.id,
        },
        (adminId) => `dispute:${report.id}:created:${adminId}`,
      )
      .catch(() => undefined);

    await auditService
      .record({
        userId: reporterId,
        action: 'DISPUTE_CREATED',
        entityType: 'Report',
        entityId: report.id,
        metadata: { targetType, targetId, taskId, category, attachments: uploaded.length },
      })
      .catch(() => undefined);

    return {
      ...report,
      attachments: mintFor(report.attachments, { id: reporterId, role: reporterRole }),
    };
  },


  /** Admin: hàng đợi tranh chấp, lọc theo trạng thái / loại. */
  getAllReports: async (viewer: { id: string; role: string }, filters: { status?: string; category?: string } = {}) => {
    const reports = await prisma.report.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.category ? { category: filters.category as DisputeCategory } : {}),
      },
      include: {
        reporter: { select: { id: true, fullName: true, email: true, role: true } },
        resolvedBy: { select: { id: true, fullName: true } },
        task: { select: { id: true, title: true, status: true } },
        attachments: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      reports.map(async (report) => ({
        ...report,
        attachments: mintFor(report.attachments, viewer),
        target:
          report.targetType === 'TASK'
            ? await prisma.maintenanceTask.findUnique({
                where: { id: report.targetId },
                select: { id: true, title: true, status: true, landlordId: true, assignedStaffId: true },
              })
            : report.targetType === 'POST'
              ? await prisma.post.findUnique({
                  where: { id: report.targetId },
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    author: { select: { id: true, fullName: true, email: true, isActive: true } },
                  },
                })
              : report.targetType === 'USER'
                ? await prisma.user.findUnique({
                    where: { id: report.targetId },
                    select: { id: true, fullName: true, email: true, isActive: true, role: true },
                  })
                : await prisma.room.findUnique({
                    where: { id: report.targetId },
                    select: { id: true, roomNumber: true, property: { select: { name: true, landlordId: true } } },
                  }),
      })),
    );
  },

  /** Người gửi xem lại báo cáo của chính mình (kèm bằng chứng của họ). */
  getMyReports: async (reporterId: string, reporterRole: string) => {
    const reports = await prisma.report.findMany({
      where: { reporterId },
      include: {
        task: { select: { id: true, title: true, status: true } },
        resolvedBy: { select: { fullName: true } },
        attachments: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reports.map((report) => ({
      ...report,
      attachments: mintFor(report.attachments, { id: reporterId, role: reporterRole }),
    }));
  },

  /**
   * Admin xử lý tranh chấp.
   *
   * - `PENDING`/`UNDER_REVIEW` -> `UNDER_REVIEW`/`RESOLVED`/`REJECTED`.
   * - `RESOLVED`/`REJECTED` là trạng thái CUỐI: không mở lại (giữ lịch sử).
   * - CAS trên `status` hiện tại: hai admin bấm cùng lúc chỉ một người thắng.
   * - Không đụng tới `users.is_active` — không tự động treo tài khoản.
   */
  resolveReport: async (
    adminId: string,
    reportId: string,
    input: { status: DisputeStatus; resolution?: string | null },
  ) => {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, status: true, reporterId: true, category: true },
    });
    if (!report) throw new AppError('Không tìm thấy báo cáo', 404);
    if (isTerminal(report.status)) {
      throw new AppError('Báo cáo này đã được xử lý xong', 409, 'DISPUTE_ALREADY_RESOLVED');
    }
    if (isTerminal(input.status) && !input.resolution) {
      throw new AppError('Cần nêu kết luận khi giải quyết hoặc bác bỏ báo cáo', 400, 'DISPUTE_RESOLUTION_REQUIRED');
    }

    const updated = await prisma.report.updateMany({
      where: { id: reportId, status: report.status },
      data: {
        status: input.status,
        resolution: input.resolution ?? null,
        ...(isTerminal(input.status) ? { resolvedById: adminId, resolvedAt: new Date() } : {}),
      },
    });
    if (updated.count !== 1) {
      throw new AppError('Báo cáo vừa được xử lý ở nơi khác, vui lòng tải lại', 409, 'DISPUTE_STATE_CONFLICT');
    }

    const fresh = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
      include: {
        reporter: { select: { id: true, fullName: true, email: true, role: true } },
        resolvedBy: { select: { id: true, fullName: true } },
        task: { select: { id: true, title: true, status: true } },
        attachments: { select: { id: true } },
      },
    });

    await notificationService
      .notifyUsers(
        [report.reporterId],
        {
          title: 'Báo cáo của bạn đã được cập nhật',
          content:
            input.status === 'RESOLVED'
              ? 'Báo cáo của bạn đã được admin giải quyết.'
              : input.status === 'REJECTED'
                ? 'Báo cáo của bạn đã được admin xem xét và không đủ căn cứ để xử lý.'
                : 'Báo cáo của bạn đang được admin xem xét.',
          type: 'DISPUTE',
          referenceId: reportId,
        },
        () => `dispute:${reportId}:${input.status}`,
      )
      .catch(() => undefined);

    await auditService
      .record({
        userId: adminId,
        action: 'DISPUTE_RESOLVED',
        entityType: 'Report',
        entityId: reportId,
        metadata: { from: report.status, to: input.status, category: report.category },
      })
      .catch(() => undefined);

    return { ...fresh, attachments: mintFor(fresh.attachments, { id: adminId, role: 'ADMIN' }) };
  },
};
