import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { PostType, Prisma } from '@prisma/client';
import { storageService } from './storage.service';

export const postService = {
  createPost: async (authorId: string, data: any, files: Express.Multer.File[]) => {
    const { title, description, price, postType, propertyId, roomId } = data;

    if (propertyId || roomId) {
      const room = roomId ? await prisma.room.findUnique({ where: { id: roomId }, include: { property: true } }) : null;
      if (room && room.property.landlordId !== authorId) {
        throw new AppError('Bạn không có quyền đăng tin cho phòng này', 403);
      }
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { landlordId: true } });
        if (!property) throw new AppError('Nhà trọ không tồn tại', 404);
        if (property.landlordId !== authorId) throw new AppError('Bạn không có quyền đăng tin cho nhà trọ này', 403);
      }
      if (roomId && !room) throw new AppError('Phòng không tồn tại', 404);
    }

    // 1. Tạo bài đăng
    const post = await prisma.post.create({
      data: {
        authorId,
        title,
        description,
        price: price ? parseFloat(price) : null,
        postType: postType as PostType,
        propertyId: propertyId || null,
        roomId: roomId || null,
        status: 'PENDING', // Mặc định chờ duyệt
      },
    });

    // 2. Nếu có file ảnh upload lên, lưu vào bảng PostImage
    if (files && files.length > 0) {
      const imageData = await Promise.all(files.map(async (file, index) => ({
        postId: post.id,
        imageUrl: await storageService.uploadImage(file, 'rental-management/posts'),
        isPrimary: index === 0, // Ảnh đầu tiên làm ảnh đại diện
      })));

      await prisma.postImage.createMany({
        data: imageData,
      });
    }

    // 3. Trả về post kèm ảnh
    return await prisma.post.findUnique({
      where: { id: post.id },
      include: { images: true },
    });
  },

  // Lấy danh sách bài đăng đã được duyệt (Dành cho mọi người xem)
  getApprovedPosts: async (query: any) => {
    const { postType, province } = query;
    
    return await prisma.post.findMany({
      where: {
        status: 'APPROVED',
        ...(postType && { postType: postType as PostType }),
        // Nếu sau này muốn tìm theo tỉnh thành (thông qua property)
        ...(province && { property: { province: province } })
      },
      include: {
        images: true,
        author: { select: { fullName: true, avatarUrl: true, phone: true } },
        property: { select: { name: true, address: true, province: true, district: true } },
        room: { select: { roomNumber: true, priceMonthly: true, area: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  },
  searchPosts: async (query: any) => {
    const { 
      keyword, minPrice, maxPrice, minArea, maxArea, 
      province, district, ward, amenityIds, 
      lat, lng, radius, sortBy, page, limit 
    } = query;

    const skip = (page - 1) * limit;

    // 1. Xây dựng điều kiện lọc (Where clause)
    const whereClause: Prisma.PostWhereInput = {
      status: 'APPROVED',
    };

    // Tìm theo từ khóa (Title hoặc Description)
    if (keyword) {
      whereClause.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    // Lọc theo Khu vực (Thông qua Property)
    if (province || district || ward) {
      whereClause.property = {
        ...(province && { province: { contains: province, mode: 'insensitive' } }),
        ...(district && { district: { contains: district, mode: 'insensitive' } }),
        ...(ward && { ward: { contains: ward, mode: 'insensitive' } }),
      };
    }

    // Lọc theo Giá & Diện tích (Thông qua Room)
    if (minPrice || maxPrice || minArea || maxArea) {
      whereClause.room = {
        ...(minPrice && { priceMonthly: { gte: minPrice } }),
        ...(maxPrice && { priceMonthly: { lte: maxPrice } }),
        ...(minArea && { area: { gte: minArea } }),
        ...(maxArea && { area: { lte: maxArea } }),
      };
    }

    // Lọc theo Tiện ích (Phải có TẤT CẢ các tiện ích được chọn)
    if (amenityIds && amenityIds.length > 0) {
      whereClause.room = {
        ...whereClause.room as any,
        roomAmenities: {
          every: { // Hoặc 'some' tùy nhu cầu. Dùng 'every' nếu muốn phòng phải có ĐỦ tiện ích
            amenityId: { in: amenityIds }
          }
        }
      };
    }

    // 2. Xử lý logic Tìm theo Bản đồ (Map View)
    // Nếu có tọa độ, ta cần lọc những bài đăng nằm trong bán kính R (km)
    if (lat && lng) {
      const r = radius || 5; // Mặc định 5km
      
      // Công thức Haversine (Sử dụng Raw Query vì Prisma chưa hỗ trợ tính toán địa lý trực tiếp)
      // Lưu ý: Để chạy hàm này, Database của fen phải là PostgreSQL (đúng chuẩn dự án)
      const nearbyProperties = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "properties"
        WHERE (
          6371 * acos(
            cos(radians(${lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lng})) 
            + sin(radians(${lat})) * sin(radians(latitude))
          )
        ) <= ${r}
      `;

      const propertyIds = nearbyProperties.map(p => p.id);

      // Cập nhật lại whereClause để chỉ lấy bài đăng thuộc các Property này
      whereClause.propertyId = { in: propertyIds };
    }

    // 3. Xử lý Sắp xếp (Sort)
    let orderBy: Prisma.PostOrderByWithRelationInput = { createdAt: 'desc' };
    if (sortBy === 'price_asc') {
      orderBy = { room: { priceMonthly: 'asc' } }; // Sắp xếp theo giá phòng
    } else if (sortBy === 'price_desc') {
      orderBy = { room: { priceMonthly: 'desc' } };
    }

    // 4. Đếm tổng số lượng (để làm phân trang)
    const total = await prisma.post.count({ where: whereClause });

    // 5. Lấy dữ liệu
    const posts = await prisma.post.findMany({
      where: whereClause,
      include: {
        images: true,
        author: { select: { fullName: true, avatarUrl: true, phone: true } },
        property: { select: { name: true, address: true, province: true, district: true, latitude: true, longitude: true } },
        room: { select: { roomNumber: true, priceMonthly: true, area: true } }
      },
      orderBy,
      skip,
      take: limit,
    });

    return {
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: posts,
    };
  },
    // Lấy bài đăng của tôi (Dành cho Landlord/Tenant tự xem bài mình đã đăng)
  getMyPosts: async (authorId: string) => {
    return await prisma.post.findMany({
      where: { authorId },
      include: { images: true, room: true, property: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  // Sửa bài đăng
  updatePost: async (userId: string, postId: string, data: any, files?: Express.Multer.File[]) => {
    // Check quyền
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new AppError('Bài đăng không tồn tại', 404);
    if (post.authorId !== userId) throw new AppError('Bạn không có quyền sửa bài này', 403);

    const { title, description, price, status } = data;

    // Nếu sửa thông tin -> Đưa về trạng thái PENDING để Admin duyệt lại
    const newStatus = (title || description || price) ? 'PENDING' : post.status;

    // Cập nhật
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(price && { price: parseFloat(price) }),
        status: newStatus,
      }
    });

    // Nếu có up thêm ảnh mới
    if (files && files.length > 0) {
      await prisma.postImage.createMany({
        data: await Promise.all(files.map(async (file, index) => ({
          postId,
          imageUrl: await storageService.uploadImage(file, 'rental-management/posts'),
          isPrimary: index === 0,
        })))
      });
    }

    return updatedPost;
  },

  // Xóa bài đăng
  deletePost: async (userId: string, role: string, postId: string) => {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new AppError('Bài đăng không tồn tại', 404);
    
    // Admin hoặc chủ bài đăng mới được xóa
    if (post.authorId !== userId && role !== 'ADMIN') {
      throw new AppError('Bạn không có quyền xóa bài này', 403);
    }

    // (Lưu ý: Prisma sẽ tự xóa ảnh trong DB nhờ onDelete Cascade, nhưng file vật lý trong thư mục uploads sẽ cần code thêm để xóa nếu muốn sạch sẽ)
    return await prisma.post.delete({ where: { id: postId } });
  }
};