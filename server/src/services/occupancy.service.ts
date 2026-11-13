import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { notificationService } from './notification.service';

/**
 * KHAI BÁO SỐ NGƯỜI Ở (Occupancy) — tenant khai, chủ trọ xác minh.
 *
 * Bất biến:
 *  1. Chỉ người có QUAN HỆ THUÊ ĐANG HIỆU LỰC (hợp đồng ACTIVE) mới được khai
 *     cho phòng đó. Kiểm tra ở server, không tin `roomId` từ client.
 *  2. Số người phải là số nguyên dương và KHÔNG vượt `rooms.max_occupants`.
 *  3. Mỗi thay đổi tạo một row MỚI ở trạng thái PENDING; row cũ (PENDING hoặc
 *     VERIFIED) chuyển SUPERSEDED. Vì vậy thay đổi luôn cần xác minh lại.
 *  4. Chỉ chủ trọ sở hữu phòng được xác minh/từ chối; quyết định là lệnh có
 *     điều kiện (`status = PENDING`) nên hai request song song chỉ một thắng.
 *  5. PENDING/REJECTED không bao giờ được dùng để tính tiền.
 *     `resolveVerifiedOccupancy` chỉ trả row đã VERIFIED và chưa bị thay thế
 *     tại thời điểm cuối kỳ.
 */

export const MAX_OCCUPANTS_PER_DECLARATION = 50;

const DECLARATION_INCLUDE = {
  room: {
    select: {
      id: true,
      roomNumber: true,
      maxOccupants: true,
      electricityRate: true,
      waterRate: true,
      property: { select: { id: true, name: true, landlordId: true } },
    },
  },
  tenant: { select: { id: true, fullName: true, phone: true, email: true } },
  declaredBy: { select: { id: true, fullName: true } },
  verifiedBy: { select: { id: true, fullName: true } },
  contract: { select: { id: true, status: true, startDate: true, endDate: true } },
} as const;

const assertOccupantsCount = (occupants: number) => {
  if (!Number.isInteger(occupants) || occupants <= 0) {
    throw new AppError('Số người ở phải là số nguyên dương', 400, 'OCCUPANTS_INVALID');
  }
  if (occupants > MAX_OCCUPANTS_PER_DECLARATION) {
    throw new AppError(
      `Số người ở không được vượt quá ${MAX_OCCUPANTS_PER_DECLARATION}`,
      400,
      'OCCUPANTS_OUT_OF_RANGE',
    );
  }
};

/** Cuối kỳ tính tiền (ngày cuối cùng của tháng, 23:59:59.999). */
export const billingPeriodEnd = (month: number, year: number): Date =>
  new Date(year, month, 0, 23, 59, 59, 999);

export type VerifiedOccupancy = {
  declarationId: string;
  occupants: number;
  verifiedAt: Date;
};

export const occupancyService = {
  /**
   * Tenant khai (hoặc cập nhật) số người ở.
   * Khai lại ĐÚNG số người đang chờ/đã xác minh là no-op (không tạo lịch sử rác).
   */
  declare: async (tenantId: string, data: { roomId: string; occupants: number }) => {
    const occupants = Number(data.occupants);
    assertOccupantsCount(occupants);

    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
      select: {
        id: true,
        roomNumber: true,
        maxOccupants: true,
        property: { select: { landlordId: true, name: true } },
      },
    });
    if (!room) throw new AppError('Không tìm thấy phòng', 404);

    if (occupants > room.maxOccupants) {
      throw new AppError(
        `Số người ở (${occupants}) vượt sức chứa tối đa của phòng ${room.roomNumber} (${room.maxOccupants})`,
        400,
        'OCCUPANCY_EXCEEDS_CAPACITY',
      );
    }

    const contract = await prisma.contract.findFirst({
      where: { roomId: room.id, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!contract) {
      throw new AppError(
        'Bạn không có hợp đồng thuê đang hiệu lực cho phòng này',
        403,
        'NO_ACTIVE_RENTAL',
      );
    }

    const current = await prisma.roomOccupancyDeclaration.findFirst({
      where: {
        roomId: room.id,
        tenantId,
        status: { in: ['PENDING', 'VERIFIED'] },
        supersededAt: null,
      },
      orderBy: { declaredAt: 'desc' },
      include: DECLARATION_INCLUDE,
    });
    if (current && current.occupants === occupants) {
      return current;
    }

    let declaration;
    try {
      declaration = await prisma.$transaction(async (tx) => {
        const now = new Date();
        await tx.roomOccupancyDeclaration.updateMany({
          where: {
            roomId: room.id,
            tenantId,
            status: { in: ['PENDING', 'VERIFIED'] },
            supersededAt: null,
          },
          data: { status: 'SUPERSEDED', supersededAt: now },
        });
        return tx.roomOccupancyDeclaration.create({
          data: {
            roomId: room.id,
            tenantId,
            contractId: contract.id,
            occupants,
            status: 'PENDING',
            declaredById: tenantId,
          },
          include: DECLARATION_INCLUDE,
        });
      });
    } catch (error: any) {
      // Partial unique index (room, tenant) WHERE PENDING/VERIFIED: hai request
      // khai song song thì một request thua ở tầng DB, không tạo hai bản PENDING.
      if (error?.code === 'P2002' || error?.code === 'P2034') {
        throw new AppError('Khai báo số người vừa được cập nhật bởi request khác', 409, 'OCCUPANCY_CONCURRENT');
      }
      throw error;
    }

    await notificationService.createNotification(
      room.property.landlordId,
      'Khai báo số người ở mới',
      `${declaration.tenant.fullName} khai ${occupants} người ở phòng ${room.roomNumber} — cần xác minh.`,
      'OCCUPANCY',
      declaration.id,
      `occupancy:${declaration.id}:pending`,
    );

    return declaration;
  },

  /** Lịch sử khai báo của chính tenant (mọi phòng). */
  listMine: async (tenantId: string) =>
    prisma.roomOccupancyDeclaration.findMany({
      where: { tenantId },
      include: DECLARATION_INCLUDE,
      orderBy: [{ declaredAt: 'desc' }],
    }),

  /**
   * Hàng đợi xác minh của chủ trọ (mọi phòng họ sở hữu).
   * Chỉ PENDING — đúng thứ cần hành động, không trộn lịch sử.
   */
  listPending: async (landlordId: string) =>
    prisma.roomOccupancyDeclaration.findMany({
      where: { status: 'PENDING', supersededAt: null, room: { property: { landlordId } } },
      include: DECLARATION_INCLUDE,
      orderBy: [{ declaredAt: 'asc' }],
    }),

  /** Toàn bộ lịch sử của một phòng (chủ trọ sở hữu) hoặc của chính tenant. */
  getRoomOccupancy: async (
    actor: { userId: string; role: string; landlordId?: string | null },
    roomId: string,
  ) => {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        roomNumber: true,
        maxOccupants: true,
        electricityRate: true,
        waterRate: true,
        property: { select: { id: true, name: true, landlordId: true } },
      },
    });
    if (!room) throw new AppError('Không tìm thấy phòng', 404);

    const ownerId = actor.role === 'LANDLORD' ? actor.userId : actor.landlordId ?? null;
    const isLandlord = Boolean(ownerId) && room.property.landlordId === ownerId;
    let isTenant = false;
    if (!isLandlord && actor.role === 'TENANT') {
      const contract = await prisma.contract.findFirst({
        where: { roomId, tenantId: actor.userId, status: 'ACTIVE' },
        select: { id: true },
      });
      isTenant = Boolean(contract);
    }
    if (!isLandlord && !isTenant) {
      throw new AppError('Bạn không có quyền xem thông tin số người ở của phòng này', 403);
    }

    const history = await prisma.roomOccupancyDeclaration.findMany({
      where: { roomId, ...(isTenant && !isLandlord ? { tenantId: actor.userId } : {}) },
      include: DECLARATION_INCLUDE,
      orderBy: [{ declaredAt: 'desc' }],
    });
    const current =
      history.find((row) => row.status === 'PENDING' || row.status === 'VERIFIED') ?? null;

    return { room, current, history };
  },


  /** Chủ trọ xác nhận. Lệnh có điều kiện: thua cuộc đua ⇒ 409, không ghi đè. */
  verify: async (landlordId: string, declarationId: string) => {
    const declaration = await prisma.roomOccupancyDeclaration.findFirst({
      where: { id: declarationId, room: { property: { landlordId } } },
      include: DECLARATION_INCLUDE,
    });
    if (!declaration) throw new AppError('Không tìm thấy khai báo hoặc bạn không có quyền', 404);

    if (declaration.status !== 'PENDING' || declaration.supersededAt) {
      throw new AppError(
        'Khai báo này không còn chờ xác minh (đã được xử lý hoặc đã bị thay thế)',
        409,
        'DECLARATION_ALREADY_DECIDED',
      );
    }

    const updated = await prisma.roomOccupancyDeclaration.updateMany({
      where: { id: declaration.id, status: 'PENDING', supersededAt: null },
      data: { status: 'VERIFIED', verifiedById: landlordId, verifiedAt: new Date(), rejectionReason: null },
    });
    if (updated.count !== 1) {
      throw new AppError('Khai báo vừa được xử lý bởi request khác', 409, 'DECLARATION_ALREADY_DECIDED');
    }

    const verified = await prisma.roomOccupancyDeclaration.findUniqueOrThrow({
      where: { id: declaration.id },
      include: DECLARATION_INCLUDE,
    });

    await notificationService.createNotification(
      declaration.tenantId,
      'Khai báo số người đã được xác minh',
      `Chủ trọ đã xác minh ${verified.occupants} người ở phòng ${verified.room.roomNumber}.`,
      'OCCUPANCY',
      verified.id,
      `occupancy:${verified.id}:verified`,
    );

    return verified;
  },

  /** Chủ trọ từ chối — lý do là BẮT BUỘC và được lưu cùng quyết định. */
  reject: async (landlordId: string, declarationId: string, reason: string) => {
    const trimmedReason = String(reason ?? '').trim();
    if (trimmedReason.length < 3) {
      throw new AppError('Cần nêu lý do từ chối (ít nhất 3 ký tự)', 400, 'REJECTION_REASON_REQUIRED');
    }

    const declaration = await prisma.roomOccupancyDeclaration.findFirst({
      where: { id: declarationId, room: { property: { landlordId } } },
      include: DECLARATION_INCLUDE,
    });
    if (!declaration) throw new AppError('Không tìm thấy khai báo hoặc bạn không có quyền', 404);

    if (declaration.status !== 'PENDING' || declaration.supersededAt) {
      throw new AppError(
        'Khai báo này không còn chờ xác minh (đã được xử lý hoặc đã bị thay thế)',
        409,
        'DECLARATION_ALREADY_DECIDED',
      );
    }

    const updated = await prisma.roomOccupancyDeclaration.updateMany({
      where: { id: declaration.id, status: 'PENDING', supersededAt: null },
      data: {
        status: 'REJECTED',
        rejectionReason: trimmedReason,
        verifiedById: landlordId,
        verifiedAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      throw new AppError('Khai báo vừa được xử lý bởi request khác', 409, 'DECLARATION_ALREADY_DECIDED');
    }

    const rejected = await prisma.roomOccupancyDeclaration.findUniqueOrThrow({
      where: { id: declaration.id },
      include: DECLARATION_INCLUDE,
    });

    await notificationService.createNotification(
      declaration.tenantId,
      'Khai báo số người bị từ chối',
      `Khai báo ${rejected.occupants} người ở phòng ${rejected.room.roomNumber} bị từ chối: ${trimmedReason}`,
      'OCCUPANCY',
      rejected.id,
      `occupancy:${rejected.id}:rejected`,
    );

    return rejected;
  },

  /**
   * Số người ĐÃ XÁC MINH áp dụng cho một kỳ hoá đơn.
   *
   * "Áp dụng" = đã xác minh trước cuối kỳ VÀ chưa bị thay thế tại thời điểm cuối
   * kỳ. Nhờ vậy:
   *  - khai báo đã bị thay thế vẫn dùng được cho kỳ TRƯỚC khi bị thay thế;
   *  - khai báo PENDING/REJECTED không bao giờ được dùng.
   */
  resolveVerifiedOccupancy: async (params: {
    roomId: string;
    tenantId: string;
    month: number;
    year: number;
  }): Promise<VerifiedOccupancy | null> => {
    const periodEnd = billingPeriodEnd(params.month, params.year);
    const candidates = await prisma.roomOccupancyDeclaration.findMany({
      where: {
        roomId: params.roomId,
        tenantId: params.tenantId,
        status: { in: ['VERIFIED', 'SUPERSEDED'] },
        verifiedAt: { not: null, lte: periodEnd },
      },
      orderBy: [{ verifiedAt: 'desc' }, { declaredAt: 'desc' }],
    });

    const applicable = candidates.find(
      (row) => !row.supersededAt || row.supersededAt.getTime() > periodEnd.getTime(),
    );
    if (!applicable || applicable.verifiedAt === null) return null;

    return {
      declarationId: applicable.id,
      occupants: applicable.occupants,
      verifiedAt: applicable.verifiedAt,
    };
  },
};

