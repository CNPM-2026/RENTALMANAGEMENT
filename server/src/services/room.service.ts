import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const roomService = {
  // Tạo phòng mới
  createRoom: async (landlordId: string, data: any) => {
    const {
      propertyId, roomNumber, priceMonthly, priceYearly,
      depositAmount, electricityRate, waterRate, internetFee, serviceFee, parkingFee,
      area, maxOccupants, amenityIds
    } = data;

    // 1. Kiểm tra nhà trọ này có tồn tại và thuộc quyền sở hữu của landlord không
    const property = await prisma.property.findFirst({
      where: { id: propertyId, landlordId }
    });

    if (!property) {
      throw new AppError('Không tìm thấy nhà trọ hoặc bạn không có quyền thêm phòng', 404);
    }

    // 2. Kiểm tra số phòng đã tồn tại trong nhà trọ này chưa
    const existingRoom = await prisma.room.findFirst({
      where: { propertyId, roomNumber }
    });
    if (existingRoom) {
      throw new AppError(`Phòng ${roomNumber} đã tồn tại trong dãy trọ này`, 400);
    }

    // 3. Tạo phòng và gắn tiện ích (Amenities) nếu có
    return await prisma.room.create({
      data: {
        propertyId,
        roomNumber,
        priceMonthly,
        priceYearly,
        depositAmount: depositAmount || 0,
        electricityRate,
        waterRate,
        internetFee,
        serviceFee,
        parkingFee,
        area,
        maxOccupants: maxOccupants || 2,
        // Nếu có truyền amenityIds, tạo các bản ghi trung gian RoomAmenity
        roomAmenities: amenityIds && amenityIds.length > 0 ? {
          create: amenityIds.map((id: string) => ({ amenityId: id }))
        } : undefined
      },
      include: {
        roomAmenities: {
          include: { amenity: true } // Trả về chi tiết tiện ích luôn
        }
      }
    });
  },

  /**
   * 🆕 Sửa phòng (giá điện/nước/sức chứa...).
   * Sức chứa KHÔNG được giảm xuống dưới số người đã được xác minh hiện tại —
   * nếu không, dữ liệu occupancy và hoá đơn sẽ mâu thuẫn ngay sau khi lưu.
   */
  updateRoom: async (landlordId: string, roomId: string, data: any) => {
    const room = await prisma.room.findFirst({
      where: { id: roomId, property: { landlordId } },
      select: { id: true, propertyId: true, roomNumber: true },
    });
    if (!room) throw new AppError('Không tìm thấy phòng hoặc bạn không có quyền sửa', 404);

    const { amenityIds, ...fields } = data;
    const updateData: Record<string, unknown> = {};
    for (const key of [
      'roomNumber',
      'priceMonthly',
      'priceYearly',
      'depositAmount',
      'electricityRate',
      'waterRate',
      'internetFee',
      'serviceFee',
      'parkingFee',
      'area',
      'maxOccupants',
    ]) {
      if (fields[key] !== undefined) updateData[key] = fields[key];
    }

    if (typeof updateData.maxOccupants === 'number') {
      const verified = await prisma.roomOccupancyDeclaration.findFirst({
        where: { roomId, status: 'VERIFIED', supersededAt: null },
        orderBy: { verifiedAt: 'desc' },
        select: { occupants: true },
      });
      if (verified && updateData.maxOccupants < verified.occupants) {
        throw new AppError(
          `Không thể giảm sức chứa xuống ${updateData.maxOccupants}: hiện có ${verified.occupants} người đã được xác minh`,
          400,
          'CAPACITY_BELOW_VERIFIED_OCCUPANTS',
        );
      }
    }

    if (typeof updateData.roomNumber === 'string' && updateData.roomNumber !== room.roomNumber) {
      const duplicate = await prisma.room.findFirst({
        where: { propertyId: room.propertyId, roomNumber: updateData.roomNumber },
        select: { id: true },
      });
      if (duplicate) {
        throw new AppError(`Phòng ${updateData.roomNumber} đã tồn tại trong dãy trọ này`, 400);
      }
    }

    return prisma.$transaction(async (tx) => {
      if (Array.isArray(amenityIds)) {
        await tx.roomAmenity.deleteMany({ where: { roomId } });
        if (amenityIds.length > 0) {
          await tx.roomAmenity.createMany({
            data: amenityIds.map((amenityId: string) => ({ roomId, amenityId })),
          });
        }
      }
      return tx.room.update({
        where: { id: roomId },
        data: updateData,
        include: { roomAmenities: { include: { amenity: true } } },
      });
    });
  },

  // Lấy danh sách phòng theo nhà trọ
  getRoomsByProperty: async (landlordId: string, propertyId: string) => {
    // Check quyền sở hữu
    const property = await prisma.property.findFirst({
      where: { id: propertyId, landlordId }
    });
    if (!property) throw new AppError('Không tìm thấy nhà trọ', 404);

    return await prisma.room.findMany({
      where: { propertyId },
      include: {
        roomAmenities: { include: { amenity: true } }
      },
      orderBy: { roomNumber: 'asc' }
    });
  },

  // Lấy danh sách tất cả tiện ích (để chủ trọ chọn khi tạo phòng)
  getAllAmenities: async () => {
    return await prisma.amenity.findMany();
  },

  deleteRoom: async (landlordId: string, roomId: string) => {
    const room = await prisma.room.findFirst({
      where: { id: roomId, property: { landlordId } },
      select: { id: true, status: true },
    });
    if (!room) throw new AppError('Không tìm thấy phòng hoặc bạn không có quyền xóa', 404);
    if (room.status === 'RENTED') {
      throw new AppError('Không thể xóa phòng đang có người thuê', 400);
    }
    return prisma.room.delete({ where: { id: roomId } });
  }
};