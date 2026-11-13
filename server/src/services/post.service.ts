import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { PostType, Prisma } from '@prisma/client';
import { storageService } from './storage.service';

export const postService = {
  getById: async (postId: string, user?: { id: string; role: string }) => {
    const post = await prisma.post.findUnique({
      where: {
        id: postId,
      },
      include: {
        images: true,
        author: { select: { id: true, fullName: true, avatarUrl: true, phone: true } },
        property: true,
        room: { include: { roomAmenities: { include: { amenity: true } } } },
      },
    });
    if (!post) throw new AppError('Không tìm thấy tin đăng', 404);

    const isAuthor = user && user.id === post.authorId;
    const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');

    if (post.status !== 'APPROVED' && !isAuthor && !isAdmin) {
      throw new AppError('Không tìm thấy tin đăng', 404);
    }

    if (!isAuthor && !isAdmin) {
      if (post.room && post.room.status !== 'AVAILABLE') {
        throw new AppError('Không tìm thấy tin đăng', 404);
      }
      if (post.expiredAt && post.expiredAt <= new Date()) {
        throw new AppError('Không tìm thấy tin đăng', 404);
      }
    }

    return post;
  },
  createPost: async (authorId: string, data: any, files: Express.Multer.File[]) => {
    const { title, description, postType, propertyId, roomId, price, expiredAt } = data;
    const bannedKeywords = await prisma.contentFilterKeyword.findMany({ select: { keyword: true } });
    const content = `${title ?? ""} ${description ?? ""}`.toLocaleLowerCase("vi-VN");
    const matchedKeyword = bannedKeywords.find(({ keyword }) => content.includes(keyword));
    if (matchedKeyword) {
      throw new AppError(`Nội dung chứa từ khóa bị cấm: "${matchedKeyword.keyword}"`, 400);
    }
    let roomPrice: number | null = null;
    let normalizedPropertyId = propertyId || null;
    let normalizedRoomId = roomId || null;

    if (propertyId || roomId) {
      const room = roomId ? await prisma.room.findUnique({ where: { id: roomId }, include: { property: true } }) : null;
      if (roomId && !room) throw new AppError('Phòng không tồn tại', 404);
      if (room) {
        roomPrice = Number(room.priceMonthly);
        normalizedPropertyId = normalizedPropertyId || room.propertyId;

        const isRoomOwner = room.property.landlordId === authorId;
        if (!isRoomOwner) {
          if (postType === 'FIND_ROOMMATE') {
            // Khách thuê được gắn tin ở ghép với chính phòng mình đang thuê. Đây là
            // dữ liệu gốc để kiểm tra sức chứa khi chấp nhận lời mời ở ghép.
            const activeContract = await prisma.contract.findFirst({
              where: { roomId: room.id, tenantId: authorId, status: 'ACTIVE' },
              select: { id: true },
            });
            if (!activeContract) {
              throw new AppError('Bạn cần có hợp đồng đang hiệu lực cho phòng này để đăng tin ở ghép', 403);
            }
          } else {
            throw new AppError('Bạn không có quyền đăng tin cho phòng này', 403);
          }
        }
      }
      if (roomId && propertyId && room && room.propertyId !== propertyId) {
        throw new AppError('Phòng không thuộc nhà trọ đã chọn', 400);
      }
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { landlordId: true } });
        if (!property) throw new AppError('Nhà trọ không tồn tại', 404);
        // Chủ trọ sở hữu nhà, hoặc tenant đang thuê phòng thuộc nhà đó (tin ở ghép).
        if (property.landlordId !== authorId && postType !== 'FIND_ROOMMATE') {
          throw new AppError('Bạn không có quyền đăng tin cho nhà trọ này', 403);
        }
        if (property.landlordId !== authorId && postType === 'FIND_ROOMMATE' && !roomId) {
          const activeContractInProperty = await prisma.contract.findFirst({
            where: {
              tenantId: authorId,
              status: 'ACTIVE',
              room: { propertyId },
            },
            select: { id: true },
          });
          if (!activeContractInProperty) {
            throw new AppError('Bạn cần có hợp đồng đang hiệu lực tại nhà trọ này để đăng tin ở ghép', 403);
          }
        }
      }
    }

    const defaultRoommateExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const normalizedExpiredAt = expiredAt
      ? new Date(expiredAt)
      : postType === 'FIND_ROOMMATE'
        ? defaultRoommateExpiry
        : null;

    const resolvedPrice = postType === 'FIND_ROOMMATE'
      ? (price !== undefined && price !== null && price !== '' ? Number(price) : roomPrice)
      : (roomPrice ?? (price !== undefined && price !== null && price !== '' ? Number(price) : null));

    // 1. Tạo bài đăng
    const post = await prisma.post.create({
      data: {
        authorId,
        title,
        description,
        price: resolvedPrice,
        postType: postType as PostType,
        propertyId: normalizedPropertyId,
        roomId: normalizedRoomId,
        expiredAt: normalizedExpiredAt,
        status: 'PENDING', // Mặc định chờ duyệt
      },
    });

    // 2. Nếu có file ảnh upload lên, lưu vào bảng PostImage
    if (files && files.length > 0) {
      const uploadedAssets: string[] = [];
      try {
        const imageData = await Promise.all(files.map(async (file, index) => {
          const imageUrl = await storageService.uploadImage(file, 'rental-management/posts');
          uploadedAssets.push(imageUrl);
          return { postId: post.id, imageUrl, isPrimary: index === 0 };
        }));
        await prisma.postImage.createMany({ data: imageData });
      } catch (error) {
        await Promise.all(uploadedAssets.map((asset) => storageService.deleteImage(asset)));
        await prisma.post.delete({ where: { id: post.id } }).catch(() => undefined);
        throw error;
      }
    }

    // 3. Trả về post kèm ảnh
    return await prisma.post.findUnique({
      where: { id: post.id },
      include: { images: true, room: true, property: true },
    });
  },

  // Lấy danh sách bài đăng đã được duyệt (Dành cho mọi người xem)
  getApprovedPosts: async (query: any) => {
    const { postType, province } = query;
    
    return await prisma.post.findMany({
      where: {
        status: 'APPROVED',
        AND: [{ OR: [{ roomId: null }, { room: { status: 'AVAILABLE' } }] }],
        OR: [{ expiredAt: null }, { expiredAt: { gt: new Date() } }],
        ...(postType && { postType: postType as PostType }),
        // Nếu sau này muốn tìm theo tỉnh thành (thông qua property)
        ...(province && { property: { province: province } })
      },
      include: {
        images: true,
        author: { select: { id: true, fullName: true, avatarUrl: true, phone: true } },
        property: { select: { name: true, address: true, province: true, district: true } },
        room: { include: { roomAmenities: { include: { amenity: true } } } }
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
    const andConditions: Prisma.PostWhereInput[] = [
      { OR: [{ expiredAt: null }, { expiredAt: { gt: new Date() } }] },
    ];
    const whereClause: Prisma.PostWhereInput = {
      status: 'APPROVED',
      AND: [
        ...andConditions,
        { OR: [{ roomId: null }, { room: { status: 'AVAILABLE' } }] },
      ],
    };

    // Tìm theo từ khóa (Title hoặc Description)
    if (keyword) {
      andConditions.push({
        OR: [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        ],
      });
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
        status: 'AVAILABLE',
        ...(minPrice && { priceMonthly: { gte: minPrice } }),
        ...(maxPrice && { priceMonthly: { lte: maxPrice } }),
        ...(minArea && { area: { gte: minArea } }),
        ...(maxArea && { area: { lte: maxArea } }),
      };
    }

    // Lọc theo Tiện ích (Phải có TẤT CẢ các tiện ích được chọn)
    if (amenityIds && amenityIds.length > 0) {
      andConditions.push(...amenityIds.map((amenityId: string) => ({
        room: { roomAmenities: { some: { amenityId } } },
      })));
    }

    // 2. Xử lý logic Tìm theo Bản đồ (Map View)
    // Nếu có tọa độ, ta cần lọc những bài đăng nằm trong bán kính R (km)
    if (lat !== undefined && lng !== undefined) {
      const r = radius || 5; // Mặc định 5km
      
      // Công thức Haversine (Sử dụng Raw Query vì Prisma chưa hỗ trợ tính toán địa lý trực tiếp)
      // Lưu ý: Để chạy hàm này, Database của fen phải là PostgreSQL (đúng chuẩn dự án)
      const nearbyProperties = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "properties"
        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND (
            6371 * acos(
              LEAST(1, GREATEST(-1,
                cos(radians(${lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lng}))
                + sin(radians(${lat})) * sin(radians(latitude))
              ))
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
        author: { select: { id: true, fullName: true, avatarUrl: true, phone: true } },
        property: { select: { name: true, address: true, province: true, district: true, latitude: true, longitude: true } },
        room: { include: { roomAmenities: { include: { amenity: true } } } }
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

    const { title, description, status, price, expiredAt } = data;
    const bannedKeywords = await prisma.contentFilterKeyword.findMany({ select: { keyword: true } });
    const content = `${title ?? post.title} ${description ?? post.description}`.toLocaleLowerCase("vi-VN");
    const matchedKeyword = bannedKeywords.find(({ keyword }) => content.includes(keyword));
    if (matchedKeyword) {
      throw new AppError(`Nội dung chứa từ khóa bị cấm: "${matchedKeyword.keyword}"`, 400);
    }
    let roomPrice: number | null | undefined;
    if (post.roomId && post.postType !== 'FIND_ROOMMATE') {
      const room = await prisma.room.findUnique({ where: { id: post.roomId }, select: { priceMonthly: true } });
      if (!room) throw new AppError('Phòng của bài đăng không còn tồn tại', 400);
      roomPrice = Number(room.priceMonthly);
    }

    const nextPrice = roomPrice !== undefined
      ? roomPrice
      : (price !== undefined && price !== null && price !== '' ? Number(price) : undefined);
    const nextExpiredAt = expiredAt !== undefined ? new Date(expiredAt) : undefined;

    // Nếu sửa thông tin -> Đưa về trạng thái PENDING để Admin duyệt lại
    const newStatus = (title || description || nextPrice !== undefined || nextExpiredAt !== undefined)
      ? 'PENDING'
      : post.status;

    // Cập nhật
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(nextPrice !== undefined && { price: nextPrice }),
        ...(nextExpiredAt !== undefined && { expiredAt: nextExpiredAt }),
        status: newStatus,
      }
    });

    // Nếu có up thêm ảnh mới
    if (files && files.length > 0) {
      const uploadedAssets: string[] = [];
      try {
        await prisma.postImage.createMany({
          data: await Promise.all(files.map(async (file, index) => {
            const imageUrl = await storageService.uploadImage(file, 'rental-management/posts');
            uploadedAssets.push(imageUrl);
            return { postId, imageUrl, isPrimary: index === 0 };
          }))
        });
      } catch (error) {
        await Promise.all(uploadedAssets.map((asset) => storageService.deleteImage(asset)));
        throw error;
      }
    }

    return updatedPost;
  },

  // Xóa bài đăng
  deletePost: async (userId: string, role: string, postId: string) => {
    const post = await prisma.post.findUnique({ where: { id: postId }, include: { images: { select: { imageUrl: true } } } });
    if (!post) throw new AppError('Bài đăng không tồn tại', 404);
    
    // Admin hoặc chủ bài đăng mới được xóa
    if (post.authorId !== userId && role !== 'ADMIN') {
      throw new AppError('Bạn không có quyền xóa bài này', 403);
    }

    const deleted = await prisma.post.delete({ where: { id: postId } });
    await Promise.all(post.images.map((image) => storageService.deleteImage(image.imageUrl)));
    return deleted;
  }
};