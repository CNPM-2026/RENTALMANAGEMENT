import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { ContractStatus } from '@prisma/client';
import { notificationService } from './notification.service';
import { roomDemandService } from './roomDemand.service';
import { assertKycApproved, loadKycState, TENANT_KYC_REQUIRED } from './kycGate.service';
import { auditService } from './audit.service';
import { contractLifecycleService } from './contractLifecycle.service';

export const contractService = {
  // 1. Chủ trọ tạo hợp đồng mới
  createContract: async (landlordId: string, data: any) => {
    const { roomId, tenantId, startDate, endDate, depositPaid, monthlyRent, terms } = data;

    // Check xem phòng có tồn tại, thuộc quyền sở hữu của landlord và đang trống không
    const room = await prisma.room.findFirst({
      where: { id: roomId },
      include: { property: true }
    });

    if (!room) throw new AppError('Không tìm thấy phòng', 404);
    if (tenantId === landlordId || room.property.landlordId === tenantId) {
      throw new AppError('Chủ trọ không thể tạo hợp đồng tự thuê phòng của chính mình', 400);
    }
    if (room.property.landlordId !== landlordId) {
      throw new AppError('Bạn không có quyền tạo hợp đồng cho phòng này', 403);
    }

    // Kiểm tra KYC bắt buộc của khách thuê trước khi lập hợp đồng
    const kycState = await loadKycState(tenantId);
    assertKycApproved(kycState, 'tạo hợp đồng thuê phòng', TENANT_KYC_REQUIRED);

    // Không cho phép tạo 2 hợp đồng ACTIVE cho cùng 1 phòng
    const existingActiveContract = await prisma.contract.findFirst({
      where: { roomId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (existingActiveContract) {
      throw new AppError('Phòng này hiện đã có hợp đồng đang có hiệu lực', 400, 'ROOM_ALREADY_RENTED');
    }

    const approvedRequest = await prisma.rentalRequest.findFirst({
      where: { roomId, tenantId, status: 'APPROVED' },
      select: { id: true },
    });
    if (room.status !== 'AVAILABLE' && !approvedRequest) {
      throw new AppError('Phòng này hiện không ở trạng thái sẵn sàng cho thuê', 400);
    }
    const tenant = await prisma.user.findUnique({ where: { id: tenantId }, select: { id: true, role: true, isActive: true } });
    if (!tenant || !tenant.isActive) {
      throw new AppError('Người thuê không hợp lệ', 400);
    }

    const resolvedDepositPaid =
      depositPaid !== undefined && depositPaid !== null && Number(depositPaid) >= 0
        ? Number(depositPaid)
        : (room.depositAmount && Number(room.depositAmount) > 0 ? room.depositAmount : room.priceMonthly);

    const resolvedMonthlyRent =
      monthlyRent !== undefined && monthlyRent !== null && Number(monthlyRent) > 0
        ? Number(monthlyRent)
        : room.priceMonthly;

    // Sử dụng Transaction để tạo hợp đồng VÀ đổi trạng thái phòng cùng lúc
    const result = await prisma.$transaction(async (tx) => {
      const activeInTx = await tx.contract.findFirst({
        where: { roomId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (activeInTx) {
        throw new AppError('Phòng này vừa được tạo hợp đồng bởi người khác', 409, 'ROOM_ALREADY_RENTED');
      }

      const claimedRoom = await tx.room.updateMany({
        where: { id: roomId, status: 'AVAILABLE' },
        data: { status: 'RENTED' },
      });
      if (claimedRoom.count !== 1 && !approvedRequest) {
        throw new AppError('Phòng này vừa được tạo hợp đồng bởi người khác', 409);
      }
      await tx.post.updateMany({
        where: { roomId, status: { in: ['PENDING', 'APPROVED'] } },
        data: { status: 'CLOSED' },
      });

      const contract = await tx.contract.create({
        data: {
          roomId,
          tenantId,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          depositPaid: resolvedDepositPaid,
          monthlyRent: resolvedMonthlyRent,
          terms,
          status: 'ACTIVE',
        },
        include: {
          room: { select: { roomNumber: true } },
          tenant: { select: { fullName: true, phone: true } }
        }
      });

      // Hợp đồng ACTIVE ⇒ phòng đã thuộc về tenant này. Huỷ mọi yêu cầu thuê /
      // lịch xem còn mở của phòng ngay trong cùng transaction.
      const cancelled = await roomDemandService.cancelOpenDemand(tx, { roomId });

      return { contract, cancelled };
    });
    await roomDemandService.notifyCancelledDemand(result.cancelled, result.contract.room.roomNumber);
    await notificationService.createNotification(
      tenantId,
      'Hợp đồng mới',
      'Chủ trọ đã tạo hợp đồng thuê mới cho bạn.',
      'CONTRACT',
      result.contract.id
    );
    await auditService.record({
      userId: landlordId,
      action: 'CONTRACT_CREATED',
      entityType: 'Contract',
      entityId: result.contract.id,
      metadata: { roomId, tenantId },
    }).catch(() => undefined);
    return result.contract;
  },

  // 2. Lấy danh sách hợp đồng (Dành cho cả Chủ trọ và Người thuê)
  getMyContracts: async (userId: string, role: string) => {
    void contractLifecycleService.checkAndNotifyExpiringContracts().catch(() => undefined);
    const whereClause: any = {};
    
    if (role === 'LANDLORD') {
      whereClause.room = { property: { landlordId: userId } };
    } else if (role === 'TENANT') {
      const userDeclarations = await prisma.roomOccupancyDeclaration.findMany({
        where: { tenantId: userId, status: { in: ['PENDING', 'VERIFIED'] }, supersededAt: null },
        select: { roomId: true, contractId: true },
      });
      const roomIds = userDeclarations.map((d) => d.roomId);
      const contractIds = userDeclarations.map((d) => d.contractId).filter(Boolean) as string[];

      if (roomIds.length > 0 || contractIds.length > 0) {
        whereClause.OR = [
          { tenantId: userId },
          ...(contractIds.length > 0 ? [{ id: { in: contractIds } }] : []),
          ...(roomIds.length > 0 ? [{ roomId: { in: roomIds }, status: 'ACTIVE' }] : []),
        ];
      } else {
        whereClause.tenantId = userId;
      }
    } else if (role === 'ADMIN') {
      // Admin is intentionally allowed to review all contracts.
    } else if (role === 'STAFF') {
      // STAFF không có membership mở được trang tenant nhưng không sở hữu hợp
      // đồng nào. STAFF có membership đã được controller đổi thành LANDLORD.
      whereClause.tenantId = userId;
    } else {
      throw new AppError('Role không được phép xem hợp đồng', 403);
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      include: {
        room: { 
          include: {
            property: {
              include: {
                landlord: { select: { id: true, fullName: true, phone: true, email: true, avatarUrl: true } },
              },
            },
            occupancyDeclarations: {
              where: { status: { in: ['PENDING', 'VERIFIED'] }, supersededAt: null },
              include: {
                tenant: { select: { id: true, fullName: true, phone: true, email: true, avatarUrl: true } },
              },
            },
          }
        },
        tenant: { select: { id: true, fullName: true, phone: true, email: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // `isExpired` là giá trị SUY RA, không ghi ngược status: hợp đồng có thể vẫn
    // ACTIVE trong DB cho tới khi chủ trọ/người thuê chọn ký tiếp hoặc chấm dứt.
    // Nhờ vậy UI hiển thị đúng "đã đến hạn" mà không cần job nền đổi trạng thái.
    const now = Date.now();
    return contracts.map((contract) => {
      const declarations = contract.room?.occupancyDeclarations ?? [];
      const primaryTenantId = contract.tenantId;

      const coTenants = [
        // 1. Người đứng tên hợp đồng (Người thuê chính)
        ...(contract.tenant
          ? [
              {
                id: contract.tenant.id,
                fullName: contract.tenant.fullName,
                phone: contract.tenant.phone,
                email: contract.tenant.email,
                avatarUrl: contract.tenant.avatarUrl,
                role: 'PRIMARY_TENANT',
                isPrimary: true,
                status: 'ACTIVE',
                joinedAt: contract.startDate,
              },
            ]
          : []),
        // 2. Những người ở ghép trong cùng phòng (khai báo cư trú)
        ...declarations
          .filter((dec) => dec.tenant && dec.tenant.id !== primaryTenantId)
          .map((dec) => ({
            id: dec.tenant.id,
            fullName: dec.tenant.fullName,
            phone: dec.tenant.phone,
            email: dec.tenant.email,
            avatarUrl: dec.tenant.avatarUrl,
            role: 'ROOMMATE',
            isPrimary: false,
            status: dec.status,
            joinedAt: dec.declaredAt,
          })),
      ];

      return {
        ...contract,
        coTenants,
        isExpired: Boolean(contract.endDate && new Date(contract.endDate).getTime() < now),
      };
    });
  },

  // 3. Cập nhật trạng thái hợp đồng (Kết thúc hợp đồng trước hạn)
  updateStatus: async (landlordId: string, contractId: string, status: ContractStatus) => {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { room: { include: { property: true } } }
    });

    if (!contract) throw new AppError('Không tìm thấy hợp đồng', 404);
    if (contract.room.property.landlordId !== landlordId) {
      throw new AppError('Bạn không có quyền thay đổi hợp đồng này', 403);
    }
    const allowedTransitions: Record<ContractStatus, ContractStatus[]> = {
      PENDING: ['ACTIVE', 'TERMINATED'],
      ACTIVE: ['EXPIRED', 'TERMINATED', 'SUSPENDED'],
      EXPIRED: [],
      TERMINATED: [],
      SUSPENDED: ['ACTIVE', 'TERMINATED'],
    };
    if (!allowedTransitions[contract.status].includes(status)) {
      throw new AppError(`Không thể chuyển hợp đồng từ ${contract.status} sang ${status}`, 400);
    }
    if (status === 'EXPIRED' && contract.endDate && new Date(contract.endDate) > new Date()) {
      throw new AppError('Hợp đồng chưa đến ngày kết thúc, không thể đánh dấu hết hạn', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      let cancelled: Awaited<ReturnType<typeof roomDemandService.cancelOpenDemand>> = {
        rentalRequests: [],
        appointments: [],
      };
      if (status === 'ACTIVE') {
        const claimedRoom = await tx.room.updateMany({
          where: { id: contract.roomId, status: 'AVAILABLE' },
          data: { status: 'RENTED' },
        });
        if (claimedRoom.count !== 1) {
          throw new AppError('Phòng không còn sẵn sàng để kích hoạt hợp đồng', 409);
        }
        await tx.post.updateMany({
          where: { roomId: contract.roomId, status: { in: ['PENDING', 'APPROVED'] } },
          data: { status: 'CLOSED' },
        });
        // Kích hoạt hợp đồng = phòng đã thuê ⇒ huỷ nhu cầu còn mở của phòng.
        cancelled = await roomDemandService.cancelOpenDemand(tx, { roomId: contract.roomId });
      } else if (status === 'TERMINATED' || status === 'EXPIRED') {
        if (contract.status === 'ACTIVE') {
          const releasedRoom = await tx.room.updateMany({
            where: { id: contract.roomId, status: 'RENTED' },
            data: { status: 'AVAILABLE' },
          });
          if (releasedRoom.count !== 1) {
            throw new AppError('Trạng thái phòng không khớp với hợp đồng đang hoạt động', 409);
          }
        }
        // Vô hiệu hoá khai báo cư trú của phòng khi hợp đồng kết thúc/chấm dứt
        await tx.roomOccupancyDeclaration.updateMany({
          where: { roomId: contract.roomId, status: { in: ['PENDING', 'VERIFIED'] }, supersededAt: null },
          data: { status: 'SUPERSEDED', supersededAt: new Date() },
        });
        // Mở lại tin đăng của phòng nếu tin đăng chưa hết hạn
        await tx.post.updateMany({
          where: {
            roomId: contract.roomId,
            status: 'CLOSED',
            OR: [{ expiredAt: null }, { expiredAt: { gt: new Date() } }],
          },
          data: { status: 'APPROVED' },
        });
      }

      const updated = await tx.contract.updateMany({
        where: { id: contractId, status: contract.status },
        data: { status },
      });
      if (updated.count !== 1) {
        throw new AppError('Hợp đồng vừa được cập nhật bởi request khác', 409);
      }

      return {
        updatedContract: await tx.contract.findUniqueOrThrow({ where: { id: contractId } }),
        cancelled,
      };
    });
    await roomDemandService.notifyCancelledDemand(result.cancelled, contract.room.roomNumber);
    await notificationService.createNotification(
      contract.tenantId,
      'Cập nhật hợp đồng',
      `Hợp đồng thuê đã được cập nhật: ${status.toLowerCase()}.`,
      'CONTRACT',
      contract.id
    );
    return result.updatedContract;
  }
};