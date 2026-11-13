import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { ContractStatus } from '@prisma/client';
import { notificationService } from './notification.service';
import { roomDemandService } from './roomDemand.service';

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
    if (room.property.landlordId !== landlordId) {
      throw new AppError('Bạn không có quyền tạo hợp đồng cho phòng này', 403);
    }
    const approvedRequest = await prisma.rentalRequest.findFirst({
      where: { roomId, tenantId, status: 'APPROVED' },
      select: { id: true },
    });
    if (room.status !== 'AVAILABLE' && !approvedRequest) {
      throw new AppError('Phòng này hiện không ở trạng thái sẵn sàng cho thuê', 400);
    }
    const tenant = await prisma.user.findUnique({ where: { id: tenantId }, select: { id: true, role: true, isActive: true } });
    if (!tenant || tenant.role !== 'TENANT' || !tenant.isActive) {
      throw new AppError('Người thuê không hợp lệ', 400);
    }

    // Sử dụng Transaction để tạo hợp đồng VÀ đổi trạng thái phòng cùng lúc
    const result = await prisma.$transaction(async (tx) => {
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
          depositPaid: room.priceMonthly,
          monthlyRent: room.priceMonthly,
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
    return result.contract;
  },

  // 2. Lấy danh sách hợp đồng (Dành cho cả Chủ trọ và Người thuê)
  getMyContracts: async (userId: string, role: string) => {
    const whereClause: any = {};
    
    if (role === 'LANDLORD') {
      whereClause.room = { property: { landlordId: userId } };
    } else if (role === 'TENANT') {
      whereClause.tenantId = userId;
    } else if (role === 'ADMIN') {
      // Admin is intentionally allowed to review all contracts.
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
                landlord: { select: { id: true, fullName: true, phone: true, email: true } },
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
    return contracts.map((contract) => ({
      ...contract,
      isExpired: Boolean(contract.endDate && new Date(contract.endDate).getTime() < now),
    }));
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
      ACTIVE: ['EXPIRED', 'TERMINATED'],
      EXPIRED: [],
      TERMINATED: [],
    };
    if (!allowedTransitions[contract.status].includes(status)) {
      throw new AppError(`Không thể chuyển hợp đồng từ ${contract.status} sang ${status}`, 400);
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