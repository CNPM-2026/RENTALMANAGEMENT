import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const roomService = {
  // Tạo phòng mới
  createRoom: async (landlordId: string, data: any) => {
    const { 
      propertyId, roomNumber, priceMonthly, priceYearly, 
      depositAmount, area, maxOccupants, amenityIds 
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
  }
};