import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const userService = {
  updateProfile: async (userId: string, data: any, file?: Express.Multer.File) => {
    const { fullName, phone, gender, dob, bio, occupation } = data;

    // Sử dụng transaction để cập nhật cả bảng User và UserProfile
    return await prisma.$transaction(async (tx) => {
      // 1. Cập nhật thông tin cơ bản ở bảng User
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          ...(fullName && { fullName }),
          ...(phone && { phone }),
          // Nếu có upload file avatar mới thì cập nhật đường dẫn
          ...(file && { avatarUrl: `/uploads/${file.filename}` }),
        }
      });

      // 2. Cập nhật thông tin chi tiết ở bảng UserProfile (Dùng upsert: có thì update, chưa có thì create)
      await tx.userProfile.upsert({
        where: { userId },
        create: { 
          userId, gender, bio, occupation,
          dob: dob ? new Date(dob) : null
        },
        update: {
          ...(gender && { gender }),
          ...(bio && { bio }),
          ...(occupation && { occupation }),
          ...(dob && { dob: new Date(dob) }),
        }
      });

      // Lấy lại thông tin full để trả về client
      return await tx.user.findUnique({
        where: { id: userId },
        include: { profile: true },
        // Nhớ giấu password đi
        select: {
          id: true, email: true, fullName: true, phone: true, avatarUrl: true, role: true, profile: true
        }
      });
    });
  }
};