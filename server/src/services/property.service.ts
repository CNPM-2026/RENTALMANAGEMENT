import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const propertyService = {
  // Tạo nhà trọ mới
  createProperty: async (landlordId: string, data: any) => {
    const { name, address, province, district, ward, description, rules, latitude, longitude } = data;
    
    // (Tùy chọn) Check xem chủ trọ đã tạo nhà trọ trùng tên ở cùng phường chưa
    const existing = await prisma.property.findFirst({
      where: { landlordId, name, ward, district }
    });
    
    if (existing) {
      throw new AppError('Bạn đã có nhà trọ với tên này ở khu vực này', 400);
    }

    return await prisma.property.create({
      data: {
        landlordId,
        name,
        address,
        province,
        district,
        ward,
        description,
        rules,
        latitude,
        longitude
      }
    });
  },

  // Lấy danh sách nhà trọ của chủ trọ hiện tại
  getMyProperties: async (landlordId: string) => {
    return await prisma.property.findMany({
      where: { landlordId },
      include: {
        _count: {
          select: { rooms: true } // Trả về tổng số phòng đang có
        }
      },
      orderBy: { createdAt: 'desc' } // Mới nhất xếp trước
    });
  }
};