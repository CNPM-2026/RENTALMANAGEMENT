import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { ContractStatus } from '@prisma/client';

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
    if (room.status !== 'AVAILABLE') {
      throw new AppError('Phòng này hiện không ở trạng thái sẵn sàng cho thuê', 400);
    }
    const tenant = await prisma.user.findUnique({ where: { id: tenantId }, select: { id: true, role: true, isActive: true } });
    if (!tenant || tenant.role !== 'TENANT' || !tenant.isActive) {
      throw new AppError('Người thuê không hợp lệ', 400);
    }

    // Sử dụng Transaction để tạo hợp đồng VÀ đổi trạng thái phòng cùng lúc
    return await prisma.$transaction(async (tx) => {
      const claimedRoom = await tx.room.updateMany({
        where: { id: roomId, status: 'AVAILABLE' },
        data: { status: 'RENTED' },
      });
      if (claimedRoom.count !== 1) {
        throw new AppError('Phòng này vừa được tạo hợp đồng bởi người khác', 409);
      }

      const contract = await tx.contract.create({
        data: {
          roomId,
          tenantId,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          depositPaid,
          monthlyRent,
          terms,
          status: 'ACTIVE',
        },
        include: {
          room: { select: { roomNumber: true } },
          tenant: { select: { fullName: true, phone: true } }
        }
      });

      return contract;
    });
  },

  // 2. Lấy danh sách hợp đồng (Dành cho cả Chủ trọ và Người thuê)
  getMyContracts: async (userId: string, role: string) => {
    const whereClause: any = {};
    
    if (role === 'LANDLORD') {
      whereClause.room = { property: { landlordId: userId } };
    } else if (role === 'TENANT') {
      whereClause.tenantId = userId;
    } else if (role === 'AGENT') {
      whereClause.agentId = userId;
    } else if (role === 'ADMIN') {
      // Admin is intentionally allowed to review all contracts.
    } else {
      throw new AppError('Role không được phép xem hợp đồng', 403);
    }

    return await prisma.contract.findMany({
      where: whereClause,
      include: {
        room: { 
          include: { property: { select: { name: true, address: true } } } 
        },
        tenant: { select: { fullName: true, phone: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
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
      ACTIVE: ['EXPIRED', 'TERMINATED'],
      EXPIRED: [],
      TERMINATED: [],
    };
    if (!allowedTransitions[contract.status].includes(status)) {
      throw new AppError(`Không thể chuyển hợp đồng từ ${contract.status} sang ${status}`, 400);
    }

    return await prisma.$transaction(async (tx) => {
      if (status === 'ACTIVE') {
        const claimedRoom = await tx.room.updateMany({
          where: { id: contract.roomId, status: 'AVAILABLE' },
          data: { status: 'RENTED' },
        });
        if (claimedRoom.count !== 1) {
          throw new AppError('Phòng không còn sẵn sàng để kích hoạt hợp đồng', 409);
        }
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

      return tx.contract.findUniqueOrThrow({ where: { id: contractId } });
    });
  }
};