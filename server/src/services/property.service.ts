import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const propertyService = {
  // Tạo nhà trọ mới (kèm tiện ích chung của tòa nhà)
  createProperty: async (landlordId: string, data: any) => {
    const { name, address, province, district, ward, description, rules, latitude, longitude, amenityIds } = data;
    
    // Check xem chủ trọ đã tạo nhà trọ trùng tên ở cùng phường chưa
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
        longitude,
        propertyAmenities: amenityIds && amenityIds.length > 0 ? {
          create: amenityIds.map((amenityId: string) => ({ amenityId }))
        } : undefined
      },
      include: {
        propertyAmenities: {
          include: { amenity: true }
        }
      }
    });
  },

  // Cập nhật nhà trọ và tiện ích chung
  updateProperty: async (landlordId: string, propertyId: string, data: any) => {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, landlordId }
    });
    if (!property) {
      throw new AppError('Nhà trọ không tồn tại hoặc bạn không có quyền chỉnh sửa', 404);
    }

    const { name, address, province, district, ward, description, rules, latitude, longitude, amenityIds } = data;

    if (Array.isArray(amenityIds)) {
      await prisma.propertyAmenity.deleteMany({
        where: { propertyId }
      });
      if (amenityIds.length > 0) {
        await prisma.propertyAmenity.createMany({
          data: amenityIds.map((amenityId: string) => ({
            propertyId,
            amenityId
          }))
        });
      }
    }

    return await prisma.property.update({
      where: { id: propertyId },
      data: {
        name,
        address,
        province,
        district,
        ward,
        description,
        rules,
        latitude,
        longitude
      },
      include: {
        propertyAmenities: {
          include: { amenity: true }
        },
        _count: { select: { rooms: true } }
      }
    });
  },

  // Lấy chi tiết nhà trọ theo ID
  getPropertyById: async (propertyId: string) => {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        landlord: {
          select: { id: true, fullName: true, phone: true, avatarUrl: true, email: true }
        },
        propertyAmenities: {
          include: { amenity: true }
        },
        rooms: {
          include: {
            roomAmenities: { include: { amenity: true } }
          }
        },
        images: true
      }
    });
    if (!property) throw new AppError('Nhà trọ không tồn tại', 404);
    return property;
  },

  // Lấy danh sách nhà trọ của chủ trọ hiện tại
  getMyProperties: async (landlordId: string) => {
    return await prisma.property.findMany({
      where: { landlordId },
      include: {
        propertyAmenities: {
          include: { amenity: true }
        },
        _count: {
          select: { rooms: true } // Trả về tổng số phòng đang có
        }
      },
      orderBy: { createdAt: 'desc' } // Mới nhất xếp trước
    });
  }
};
