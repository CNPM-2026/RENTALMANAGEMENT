import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { PostType } from '@prisma/client';

export const postService = {
  createPost: async (authorId: string, data: any, files: Express.Multer.File[]) => {
    const { title, description, price, postType, propertyId, roomId } = data;

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
      const imageData = files.map((file, index) => ({
        postId: post.id,
        imageUrl: `/uploads/${file.filename}`, // Đường dẫn tương đối
        isPrimary: index === 0, // Ảnh đầu tiên làm ảnh đại diện
      }));

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
  }
};