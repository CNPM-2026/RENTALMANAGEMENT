import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { notificationService } from './notification.service';
import { storageService } from './storage.service';
import { roomDemandService } from './roomDemand.service';
import { mintContractTerminationAttachmentUrl } from './contractTerminationAttachment.service';
import type {
  ContractTerminationReason,
  ContractTerminationStatus,
  ContractRenewalStatus,
} from '@prisma/client';

/**
 * VÒNG ĐỜI HỢP ĐỒNG SAU KHI KÝ.
 *
 * 1. CHẤM DỨT: một bên gửi yêu cầu + bằng chứng → ADMIN duyệt. Chỉ khi được
 *    duyệt hợp đồng mới TERMINATED và phòng trả về AVAILABLE. Nếu lý do là chủ
 *    trọ vi phạm, server BẮT BUỘC hoàn đủ tiền cọc.
 * 2. GIA HẠN / KÝ TIẾP: một bên đề xuất, bên còn lại phản hồi. Khi đồng ý,
 *    hợp đồng được cập nhật và (nếu đã EXPIRED) phòng được claim lại.
 *
 * Hợp đồng `endDate = null` là VÔ THỜI HẠN — không cần gia hạn.
 */

const EVIDENCE_FOLDER = 'rental-management/contract-terminations';
const MAX_EVIDENCE = 5;

const TERMINATION_INCLUDE = {
  contract: {
    include: {
      room: {
        include: {
          property: {
            include: {
              landlord: { select: { id: true, fullName: true, phone: true, email: true } },
            },
          },
        },
      },
      tenant: { select: { id: true, fullName: true, phone: true, email: true, avatarUrl: true } },
    },
  },
  requestedBy: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
  reviewedBy: { select: { id: true, fullName: true, role: true } },
  attachments: { orderBy: { createdAt: 'asc' } },
} as const;

const RENEWAL_INCLUDE = {
  contract: {
    include: {
      room: {
        include: {
          property: {
            include: {
              landlord: { select: { id: true, fullName: true, phone: true, email: true } },
            },
          },
        },
      },
      tenant: { select: { id: true, fullName: true, phone: true, email: true, avatarUrl: true } },
    },
  },
  requestedBy: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
  respondedBy: { select: { id: true, fullName: true, role: true } },
} as const;

const uploadEvidenceFiles = async (files: Express.Multer.File[]) => {
  if (!files.length) return [];
  const uploaded: Array<{ fileRef: string; mimeType: string; byteSize: number }> = [];
  try {
    for (const file of files.slice(0, MAX_EVIDENCE)) {
      const fileRef = await storageService.uploadPrivateImage(file, EVIDENCE_FOLDER);
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

const mintAttachments = <T extends { id: string }>(
  attachments: T[],
  viewer: { id: string; role: string },
) =>
  attachments.map((attachment) => {
    const { fileRef: _fileRef, ...safe } = attachment as T & { fileRef?: string };
    return {
      ...safe,
      url: mintContractTerminationAttachmentUrl(attachment.id, viewer),
    };
  });

const loadContractForParty = async (contractId: string) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      room: { include: { property: true } },
      tenant: { select: { id: true, fullName: true } },
    },
  });
  if (!contract) throw new AppError('Không tìm thấy hợp đồng', 404);
  return contract;
};

const assertParty = (
  contract: { tenantId: string; room: { property: { landlordId: string } } },
  userId: string,
) => {
  const isTenant = contract.tenantId === userId;
  const isLandlord = contract.room.property.landlordId === userId;
  if (!isTenant && !isLandlord) {
    throw new AppError('Bạn không phải một bên của hợp đồng này', 403, 'CONTRACT_FORBIDDEN');
  }
  return { isTenant, isLandlord };
};

const notifyAdmins = async (payload: {
  title: string;
  content: string;
  referenceId: string;
  dedupeKey: string;
}) => {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  await notificationService
    .notifyUsers(
      admins.map((admin) => admin.id),
      {
        title: payload.title,
        content: payload.content,
        type: 'CONTRACT_TERMINATION',
        referenceId: payload.referenceId,
      },
      (adminId) => `${payload.dedupeKey}:${adminId}`,
    )
    .catch(() => undefined);
};

const notifyParties = async (
  contract: { tenantId: string; room: { property: { landlordId: string } } },
  actorId: string,
  payload: {
    title: string;
    content: string;
    referenceId: string;
    type: 'CONTRACT_TERMINATION' | 'CONTRACT_RENEWAL';
  },
) => {
  const recipients = [contract.tenantId, contract.room.property.landlordId].filter(
    (id) => id !== actorId,
  );
  await notificationService
    .notifyUsers(recipients, {
      title: payload.title,
      content: payload.content,
      type: payload.type,
      referenceId: payload.referenceId,
    })
    .catch(() => undefined);
};

export const contractLifecycleService = {
  /**
   * Gửi yêu cầu chấm dứt. Bằng chứng là TỆP do client upload (không nhận URL),
   * tối thiểu 01 ảnh — yêu cầu huỷ hợp đồng không có bằng chứng bị từ chối.
   */
  createTerminationRequest: async (
    actor: { id: string; role: string },
    contractId: string,
    input: {
      reason: ContractTerminationReason;
      details: string;
      requestedEffectiveDate?: Date | null;
    },
    files: Express.Multer.File[],
  ) => {
    if (!files.length) {
      throw new AppError('Cần tải lên ít nhất một ảnh bằng chứng cho yêu cầu chấm dứt', 400);
    }
    const contract = await loadContractForParty(contractId);
    const { isTenant, isLandlord } = assertParty(contract, actor.id);

    if (contract.status === 'TERMINATED' || contract.status === 'PENDING') {
      throw new AppError('Hợp đồng này không còn ở trạng thái có thể chấm dứt', 400);
    }
    if (input.reason === 'LANDLORD_VIOLATION' && !isTenant) {
      throw new AppError('Chỉ người thuê mới được nêu lý do chủ trọ vi phạm', 403, 'TERMINATION_REASON_FORBIDDEN');
    }
    if (
      (input.reason === 'TENANT_MOVED_OUT' || input.reason === 'TENANT_VIOLATION') &&
      !isLandlord
    ) {
      throw new AppError('Chỉ chủ trọ mới được nêu lý do người thuê chuyển đi / vi phạm', 403, 'TERMINATION_REASON_FORBIDDEN');
    }
    const pending = await prisma.contractTerminationRequest.findFirst({
      where: { contractId, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw new AppError('Hợp đồng đã có yêu cầu chấm dứt đang chờ Admin duyệt', 409, 'TERMINATION_PENDING');
    }

    const uploaded = await uploadEvidenceFiles(files);
    const deposit = Number(contract.depositPaid);
    const refundRequired = input.reason === 'LANDLORD_VIOLATION';

    let request;
    try {
      request = await prisma.contractTerminationRequest.create({
        data: {
          contractId,
          requestedById: actor.id,
          initiatorRole: actor.role === 'LANDLORD' ? 'LANDLORD' : 'TENANT',
          reason: input.reason,
          details: input.details,
          requestedEffectiveDate: input.requestedEffectiveDate ?? null,
          depositRefundRequired: refundRequired,
          depositRefundAmount: refundRequired ? deposit : 0,
          attachments: { create: uploaded },
        },
        include: TERMINATION_INCLUDE,
      });
    } catch (error) {
      await Promise.all(
        uploaded.map((item) => storageService.deleteImage(item.fileRef, 'authenticated').catch(() => undefined)),
      );
      throw error;
    }

    await notifyAdmins({
      title: 'Yêu cầu chấm dứt hợp đồng mới',
      content: `${actor.role === 'LANDLORD' ? 'Chủ trọ' : 'Người thuê'} vừa gửi yêu cầu chấm dứt hợp đồng phòng ${contract.room.roomNumber}. Vui lòng kiểm tra bằng chứng và duyệt.`,
      referenceId: request.id,
      dedupeKey: `contract-termination:${request.id}:created`,
    });
    await notifyParties(contract, actor.id, {
      title: 'Có yêu cầu chấm dứt hợp đồng',
      content: `Một yêu cầu chấm dứt hợp đồng phòng ${contract.room.roomNumber} vừa được gửi và đang chờ Admin duyệt.`,
      referenceId: request.id,
      type: 'CONTRACT_TERMINATION',
    });

    return { ...request, attachments: mintAttachments(request.attachments, actor) };
  },

  getTerminationRequests: async (
    actor: { id: string; role: string },
    status?: ContractTerminationStatus,
  ) => {
    const scope =
      actor.role === 'ADMIN'
        ? {}
        : actor.role === 'LANDLORD'
          ? { contract: { room: { property: { landlordId: actor.id } } } }
          : {
              OR: [
                { requestedById: actor.id },
                { contract: { tenantId: actor.id } },
              ],
            };
    const requests = await prisma.contractTerminationRequest.findMany({
      where: { ...(status ? { status } : {}), ...scope },
      include: TERMINATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((request) => ({
      ...request,
      attachments: mintAttachments(request.attachments, actor),
    }));
  },

  /**
   * Admin duyệt / từ chối. CAS trên `status = PENDING` để hai admin bấm cùng
   * lúc chỉ một người thắng; thay đổi hợp đồng/phòng nằm cùng transaction.
   */
  reviewTerminationRequest: async (
    admin: { id: string; role: string },
    requestId: string,
    input: {
      status: Extract<ContractTerminationStatus, 'APPROVED' | 'REJECTED'>;
      reviewNote: string;
      refundAmount?: number | null;
      effectiveDate?: Date | null;
    },
  ) => {
    const request = await prisma.contractTerminationRequest.findUnique({
      where: { id: requestId },
      include: TERMINATION_INCLUDE,
    });
    if (!request) throw new AppError('Không tìm thấy yêu cầu chấm dứt', 404);
    if (request.status !== 'PENDING') {
      throw new AppError('Yêu cầu này đã được xử lý bởi Admin khác', 409, 'TERMINATION_ALREADY_REVIEWED');
    }

    const deposit = Number(request.contract.depositPaid);
    const isLandlordFault = request.reason === 'LANDLORD_VIOLATION';
    let refundAmount = 0;

    if (input.status === 'APPROVED') {
      if (isLandlordFault) {
        if (input.refundAmount != null && Number(input.refundAmount) !== deposit) {
          throw new AppError(
            'Khi chủ trọ vi phạm, mức hoàn cọc bắt buộc bằng toàn bộ tiền cọc đã thu',
            400,
            'DEPOSIT_REFUND_REQUIRED',
          );
        }
        refundAmount = deposit;
      } else {
        refundAmount = Number(input.refundAmount ?? request.depositRefundAmount ?? 0);
        if (!Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > deposit) {
          throw new AppError(`Mức hoàn cọc phải trong khoảng 0 - ${deposit}`, 400, 'REFUND_AMOUNT_INVALID');
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.contractTerminationRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: {
          status: input.status,
          reviewNote: input.reviewNote,
          reviewedById: admin.id,
          reviewedAt: new Date(),
          ...(input.status === 'APPROVED'
            ? {
                depositRefundRequired: refundAmount > 0,
                depositRefundAmount: refundAmount,
                refundStatus: refundAmount > 0 ? 'PENDING' : 'NOT_REQUIRED',
                requestedEffectiveDate: input.effectiveDate ?? request.requestedEffectiveDate,
              }
            : {
                depositRefundRequired: false,
                depositRefundAmount: 0,
                refundStatus: 'NOT_REQUIRED',
              }),
        },
      });
      if (claimed.count !== 1) {
        throw new AppError('Yêu cầu này đã được xử lý bởi Admin khác', 409, 'TERMINATION_ALREADY_REVIEWED');
      }

      if (input.status === 'APPROVED') {
        const terminated = await tx.contract.updateMany({
          where: { id: request.contractId, status: { in: ['ACTIVE', 'EXPIRED'] } },
          data: { status: 'TERMINATED' },
        });
        if (terminated.count !== 1) {
          throw new AppError('Hợp đồng không còn ở trạng thái có thể chấm dứt', 409);
        }
        await tx.room.updateMany({
          where: { id: request.contract.roomId, status: 'RENTED' },
          data: { status: 'AVAILABLE' },
        });
      }

      return tx.contractTerminationRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: TERMINATION_INCLUDE,
      });
    });

    await notifyParties(request.contract, admin.id, {
      title: input.status === 'APPROVED' ? 'Yêu cầu chấm dứt đã được duyệt' : 'Yêu cầu chấm dứt bị từ chối',
      content:
        input.status === 'APPROVED'
          ? `Hợp đồng phòng ${request.contract.room.roomNumber} đã chấm dứt. ${
              refundAmount > 0
                ? `Chủ trọ phải hoàn ${refundAmount.toLocaleString('vi-VN')} đ tiền cọc cho người thuê.`
                : 'Không phát sinh nghĩa vụ hoàn cọc theo quyết định của Admin.'
            }`
          : `Yêu cầu chấm dứt hợp đồng phòng ${request.contract.room.roomNumber} bị từ chối. Lý do: ${input.reviewNote}`,
      referenceId: request.id,
      type: 'CONTRACT_TERMINATION',
    });

    return { ...result, attachments: mintAttachments(result.attachments, admin) };
  },

  /** Chủ trọ xác nhận đã chuyển tiền cọc cho người thuê. */
  confirmDepositRefund: async (landlordId: string, requestId: string) => {
    const request = await prisma.contractTerminationRequest.findUnique({
      where: { id: requestId },
      include: TERMINATION_INCLUDE,
    });
    if (!request) throw new AppError('Không tìm thấy yêu cầu chấm dứt', 404);
    if (request.contract.room.property.landlordId !== landlordId) {
      throw new AppError('Bạn không có quyền xác nhận yêu cầu này', 403);
    }
    if (request.status !== 'APPROVED' || request.refundStatus !== 'PENDING') {
      throw new AppError('Yêu cầu này không có khoản cọc đang chờ hoàn', 400);
    }

    const updated = await prisma.contractTerminationRequest.update({
      where: { id: requestId },
      data: { refundStatus: 'PAID', refundPaidAt: new Date() },
      include: TERMINATION_INCLUDE,
    });

    await notifyParties(request.contract, landlordId, {
      title: 'Đã hoàn tiền cọc',
      content: `Chủ trọ đã xác nhận hoàn ${Number(request.depositRefundAmount ?? 0).toLocaleString('vi-VN')} đ tiền cọc cho hợp đồng phòng ${request.contract.room.roomNumber}.`,
      referenceId: request.id,
      type: 'CONTRACT_TERMINATION',
    });

    return {
      ...updated,
      attachments: mintAttachments(updated.attachments, { id: landlordId, role: 'LANDLORD' }),
    };
  },

  /** Một bên đề xuất ký tiếp; bên còn lại phản hồi ở `respondRenewalRequest`. */
  createRenewalRequest: async (
    actor: { id: string; role: string },
    contractId: string,
    input: {
      proposedEndDate?: Date | null;
      proposedMonthlyRent?: number | null;
      note?: string | null;
    },
  ) => {
    const contract = await loadContractForParty(contractId);
    assertParty(contract, actor.id);
    if (contract.status !== 'ACTIVE' && contract.status !== 'EXPIRED') {
      throw new AppError('Chỉ hợp đồng đang hiệu lực hoặc đã hết hạn mới có thể gia hạn', 400);
    }
    if (!contract.endDate) {
      throw new AppError('Hợp đồng này là vô thời hạn, không cần gia hạn', 400, 'CONTRACT_INDEFINITE');
    }
    const pending = await prisma.contractRenewalRequest.findFirst({
      where: { contractId, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw new AppError('Hợp đồng đã có yêu cầu gia hạn đang chờ phản hồi', 409, 'RENEWAL_PENDING');
    }

    const proposedEndDate = input.proposedEndDate ?? null;
    if (proposedEndDate) {
      const minimum = Math.max(
        new Date().getTime(),
        contract.endDate ? new Date(contract.endDate).getTime() : 0,
      );
      if (proposedEndDate.getTime() <= minimum) {
        throw new AppError('Ngày kết thúc mới phải sau ngày hết hạn hiện tại', 400);
      }
    }

    const request = await prisma.contractRenewalRequest.create({
      data: {
        contractId,
        requestedById: actor.id,
        proposedEndDate,
        proposedMonthlyRent: input.proposedMonthlyRent ?? null,
        note: input.note ?? null,
      },
      include: RENEWAL_INCLUDE,
    });

    await notifyParties(contract, actor.id, {
      title: 'Có đề xuất ký tiếp hợp đồng',
      content: `Một đề xuất ký tiếp hợp đồng phòng ${contract.room.roomNumber} đang chờ bạn phản hồi.`,
      referenceId: request.id,
      type: 'CONTRACT_RENEWAL',
    });

    return request;
  },

  getRenewalRequests: async (
    actor: { id: string; role: string },
    status?: ContractRenewalStatus,
  ) => {
    const scope =
      actor.role === 'ADMIN'
        ? {}
        : actor.role === 'LANDLORD'
          ? { contract: { room: { property: { landlordId: actor.id } } } }
          : {
              OR: [
                { requestedById: actor.id },
                { contract: { tenantId: actor.id } },
              ],
            };
    return prisma.contractRenewalRequest.findMany({
      where: { ...(status ? { status } : {}), ...scope },
      include: RENEWAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Bên còn lại đồng ý / từ chối ký tiếp. Khi đồng ý và hợp đồng đã EXPIRED,
   * phòng được claim lại (AVAILABLE → RENTED) và nhu cầu thuê đang mở của phòng
   * bị huỷ trong cùng transaction — không thể có hai nguồn cùng giữ phòng.
   */
  respondRenewalRequest: async (
    actor: { id: string; role: string },
    requestId: string,
    input: { status: Extract<ContractRenewalStatus, 'APPROVED' | 'DECLINED'>; note?: string | null },
  ) => {
    const request = await prisma.contractRenewalRequest.findUnique({
      where: { id: requestId },
      include: RENEWAL_INCLUDE,
    });
    if (!request) throw new AppError('Không tìm thấy yêu cầu gia hạn', 404);
    if (request.status !== 'PENDING') {
      throw new AppError('Yêu cầu gia hạn này đã được xử lý', 409, 'RENEWAL_ALREADY_RESPONDED');
    }
    if (request.requestedById === actor.id) {
      throw new AppError('Bạn không thể tự phản hồi đề xuất của chính mình', 403);
    }
    assertParty(request.contract, actor.id);
    if (request.contract.status === 'TERMINATED') {
      throw new AppError('Hợp đồng đã chấm dứt, không thể gia hạn', 400);
    }

    let cancelled: Awaited<ReturnType<typeof roomDemandService.cancelOpenDemand>> = {
      rentalRequests: [],
      appointments: [],
    };

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.contractRenewalRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: {
          status: input.status,
          respondedById: actor.id,
          respondedAt: new Date(),
          responseNote: input.note ?? null,
        },
      });
      if (claimed.count !== 1) {
        throw new AppError('Yêu cầu gia hạn này đã được xử lý', 409, 'RENEWAL_ALREADY_RESPONDED');
      }

      if (input.status === 'APPROVED') {
        if (request.contract.status === 'EXPIRED') {
          const room = await tx.room.findUnique({
            where: { id: request.contract.roomId },
            select: { status: true },
          });
          if (!room) throw new AppError('Không tìm thấy phòng của hợp đồng', 404);
          if (room.status !== 'AVAILABLE') {
            throw new AppError('Phòng đã được cho thuê hoặc không còn trống để ký tiếp', 409, 'ROOM_NOT_AVAILABLE');
          }
          const claimedRoom = await tx.room.updateMany({
            where: { id: request.contract.roomId, status: 'AVAILABLE' },
            data: { status: 'RENTED' },
          });
          if (claimedRoom.count !== 1) {
            throw new AppError('Phòng vừa được cho thuê bởi giao dịch khác', 409, 'ROOM_NOT_AVAILABLE');
          }
          await tx.post.updateMany({
            where: { roomId: request.contract.roomId, status: { in: ['PENDING', 'APPROVED'] } },
            data: { status: 'CLOSED' },
          });
          cancelled = await roomDemandService.cancelOpenDemand(tx, { roomId: request.contract.roomId });
        }

        await tx.contract.update({
          where: { id: request.contractId },
          data: {
            status: 'ACTIVE',
            endDate: request.proposedEndDate,
            ...(request.proposedMonthlyRent != null
              ? { monthlyRent: request.proposedMonthlyRent }
              : {}),
          },
        });
      }

      return tx.contractRenewalRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: RENEWAL_INCLUDE,
      });
    });

    if (input.status === 'APPROVED') {
      await roomDemandService.notifyCancelledDemand(cancelled, request.contract.room.roomNumber);
    }
    await notifyParties(request.contract, actor.id, {
      title: input.status === 'APPROVED' ? 'Hợp đồng đã được ký tiếp' : 'Đề xuất ký tiếp bị từ chối',
      content:
        input.status === 'APPROVED'
          ? `Hợp đồng phòng ${request.contract.room.roomNumber} đã được gia hạn${
              request.proposedEndDate
                ? ` đến ${new Date(request.proposedEndDate).toLocaleDateString('vi-VN')}`
                : ' không thời hạn'
            }.`
          : `Đề xuất ký tiếp hợp đồng phòng ${request.contract.room.roomNumber} đã bị từ chối.`,
      referenceId: request.id,
      type: 'CONTRACT_RENEWAL',
    });

    return updated;
  }
};
