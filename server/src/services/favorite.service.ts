import prisma from '../config/db';

export const favoriteService = {
  // Thêm/Xóa khỏi danh sách yêu thích (Toggle)
  toggleFavorite: async (userId: string, postId: string) => {
    const existing = await prisma.favorite.findUnique({
      where: { userId_postId: { userId, postId } }
    });

    if (existing) {
      // Nếu đã lưu rồi thì bấm lần nữa là Hủy lưu
      await prisma.favorite.delete({ where: { userId_postId: { userId, postId } } });
      return { message: 'Đã bỏ lưu bài đăng', isFavorited: false };
    } else {
      // Chưa lưu thì thêm vào
      await prisma.favorite.create({ data: { userId, postId } });
      return { message: 'Đã lưu bài đăng', isFavorited: true };
    }
  },

  // Lấy danh sách bài đăng đã lưu
  getMyFavorites: async (userId: string) => {
    return await prisma.favorite.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            images: true,
            room: { select: { priceMonthly: true, area: true } },
            property: { select: { district: true, province: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
};