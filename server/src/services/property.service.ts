import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const propertyService = {
  // Tạo nhà trọ mới kèm tiện ích chung (nếu có)
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
          create: amenityIds.map((id: string) => ({ amenityId: id }))
        } : undefined
      },
      include: {
        propertyAmenities: {
          include: { amenity: true }
        }
      }
    });
  },

  // Cập nhật thông tin nhà trọ & tiện ích chung
  updateProperty: async (landlordId: string, id: string, data: any) => {
    const property = await prisma.property.findFirst({
      where: { id, landlordId }
    });
    if (!property) throw new AppError('Không tìm thấy nhà trọ hoặc bạn không có quyền sửa', 404);

    const { amenityIds, ...fields } = data;
    return await prisma.$transaction(async (tx) => {
      if (Array.isArray(amenityIds)) {
        await tx.propertyAmenity.deleteMany({ where: { propertyId: id } });
        if (amenityIds.length > 0) {
          await tx.propertyAmenity.createMany({
            data: amenityIds.map((amenityId: string) => ({ propertyId: id, amenityId }))
          });
        }
      }
      return await tx.property.update({
        where: { id },
        data: fields,
        include: {
          propertyAmenities: {
            include: { amenity: true }
          },
          _count: {
            select: { rooms: true }
          }
        }
      });
    });
  },

  // Lấy chi tiết một cơ sở kèm tiện ích chung
  getPropertyById: async (landlordId: string, id: string) => {
    const property = await prisma.property.findFirst({
      where: { id, landlordId },
      include: {
        propertyAmenities: {
          include: { amenity: true }
        },
        rooms: {
          include: {
            roomAmenities: {
              include: { amenity: true }
            }
          }
        }
      }
    });
    if (!property) throw new AppError('Không tìm thấy nhà trọ', 404);
    return property;
  },

  // Lấy danh sách nhà trọ của chủ trọ hiện tại kèm tiện ích chung
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