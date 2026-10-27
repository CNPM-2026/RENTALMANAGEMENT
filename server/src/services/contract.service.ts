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
    if (room.status === 'RENTED') {
      throw new AppError('Phòng này đã có người thuê', 400);
    }

    // Sử dụng Transaction để tạo hợp đồng VÀ đổi trạng thái phòng cùng lúc
    return await prisma.$transaction(async (tx) => {
      // Tạo hợp đồng
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

      // Đổi trạng thái phòng thành Đã thuê
      await tx.room.update({
        where: { id: roomId },
        data: { status: 'RENTED' }
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

    return await prisma.$transaction(async (tx) => {
      // Cập nhật trạng thái hợp đồng
      const updatedContract = await tx.contract.update({
        where: { id: contractId },
        data: { status }
      });

      // Nếu hợp đồng bị TERMINATED (chấm dứt) hoặc EXPIRED (hết hạn) -> Trả phòng về trạng thái AVAILABLE
      if (status === 'TERMINATED' || status === 'EXPIRED') {
        await tx.room.update({
          where: { id: contract.roomId },
          data: { status: 'AVAILABLE' }
        });
      }

      return updatedContract;
    });
  }
};