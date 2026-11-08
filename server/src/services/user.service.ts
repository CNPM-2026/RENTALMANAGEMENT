import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { storageService } from './storage.service';

export const userService = {
  updateProfile: async (userId: string, data: any, file?: Express.Multer.File) => {
    const { fullName, phone, gender, dob, bio, occupation } = data;
    const previous = file ? await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } }) : null;
    const avatarUrl = file ? await storageService.uploadImage(file, 'rental-management/avatars') : undefined;
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(fullName && { fullName }),
            ...(phone && { phone }),
            ...(avatarUrl && { avatarUrl }),
          }
        });

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

        return await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true, email: true, fullName: true, phone: true, avatarUrl: true, role: true, profile: true
          }
        });
      });
      if (avatarUrl && previous?.avatarUrl && previous.avatarUrl !== avatarUrl) {
        await storageService.deleteImage(previous.avatarUrl);
      }
      return result;
    } catch (error) {
      if (avatarUrl) await storageService.deleteImage(avatarUrl);
      throw error;
    }
  },

  submitKyc: async (userId: string, data: {
    idNumber: string;
    permanentAddress: string;
    frontIdUrl: string;
    backIdUrl: string;
  }) => (async () => {
    const previous = await prisma.kycSubmission.findUnique({ where: { userId }, select: { frontIdUrl: true, backIdUrl: true } });
    const result = await prisma.kycSubmission.upsert({
      where: { userId },
      create: { userId, ...data, status: 'PENDING' },
      update: { ...data, status: 'PENDING', rejectionReason: null, reviewedById: null, reviewedAt: null },
    });
    await Promise.all([
      previous?.frontIdUrl && storageService.deleteImage(previous.frontIdUrl, 'authenticated'),
      previous?.backIdUrl && storageService.deleteImage(previous.backIdUrl, 'authenticated'),
    ]);
    return result;
  })(),

  getMyKyc: async (userId: string) => {
    const result = await prisma.kycSubmission.findUnique({ where: { userId } });
    return result && {
      ...result,
      frontIdUrl: storageService.getPrivateImageUrl(result.frontIdUrl),
      backIdUrl: storageService.getPrivateImageUrl(result.backIdUrl),
    };
  },
};