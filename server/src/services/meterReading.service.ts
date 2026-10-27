import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const meterReadingService = {
  createReading: async (landlordId: string, data: any) => {
    const { roomId, month, year, electricityStart, electricityEnd, waterStart, waterEnd } = data;

    // Check quyền sở hữu phòng
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { property: true }
    });

    if (!room) throw new AppError('Không tìm thấy phòng', 404);
    if (room.property.landlordId !== landlordId) {
      throw new AppError('Bạn không có quyền ghi chỉ số cho phòng này', 403);
    }

    // Validate logic: Số cuối phải lớn hơn hoặc bằng số đầu
    if (electricityEnd < electricityStart) throw new AppError('Chỉ số điện cuối kỳ không hợp lệ', 400);
    if (waterEnd < waterStart) throw new AppError('Chỉ số nước cuối kỳ không hợp lệ', 400);

    // Check xem tháng này đã ghi chưa
    const existing = await prisma.meterReading.findUnique({
      where: { roomId_month_year: { roomId, month, year } }
    });
    if (existing) throw new AppError(`Đã ghi nhận chỉ số cho phòng này vào tháng ${month}/${year}`, 400);

    return await prisma.meterReading.create({
      data: { roomId, month, year, electricityStart, electricityEnd, waterStart, waterEnd }
    });
  }
};