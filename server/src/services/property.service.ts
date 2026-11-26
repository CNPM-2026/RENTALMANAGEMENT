import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { formatVietnameseAddress } from '../utils/crypto';

export const propertyService = {
  // Tạo nhà trọ mới kèm tiện ích chung (nếu có)
  createProperty: async (landlordId: string, data: any) => {
    const { name, address, province, district, ward, description, rules, latitude, longitude, amenityIds } = data;
    
    // Tự động ghi hoa đầu các chữ cho địa chỉ
    const formattedAddress = address ? formatVietnameseAddress(address) : address;
    const formattedProvince = province ? formatVietnameseAddress(province) : province;
    const formattedDistrict = district ? formatVietnameseAddress(district) : district;
    const formattedWard = ward ? formatVietnameseAddress(ward) : ward;

    // Check xem chủ trọ đã tạo nhà trọ trùng tên ở cùng phường chưa
    const existing = await prisma.property.findFirst({
      where: { landlordId, name, ward: formattedWard, district: formattedDistrict }
    });
    
    if (existing) {
      throw new AppError('Bạn đã có nhà trọ với tên này ở khu vực này', 400);
    }

    return await prisma.property.create({
      data: {
        landlordId,
        name,
        address: formattedAddress,
        province: formattedProvince,
        district: formattedDistrict,
        ward: formattedWard,
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
    if (fields.address) fields.address = formatVietnameseAddress(fields.address);
    if (fields.province) fields.province = formatVietnameseAddress(fields.province);
    if (fields.district) fields.district = formatVietnameseAddress(fields.district);
    if (fields.ward) fields.ward = formatVietnameseAddress(fields.ward);

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