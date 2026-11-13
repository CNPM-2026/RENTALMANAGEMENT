import prisma from '../config/db';
import { AppError } from '../utils/AppError';

/**
 * GHI CHỈ SỐ ĐIỆN NƯỚC (Batch 7).
 *
 * Chỉ số ĐẦU kỳ không còn do client gửi cứng `0`: nếu thiếu, server lấy chỉ số
 * CUỐI của kỳ gần nhất của chính phòng đó (chỉ khi phòng chưa từng có chỉ số mới
 * dùng 0). Nhờ vậy lượng tiêu thụ không bị tính lại từ 0 — lỗi khiến hoá đơn từ
 * tháng thứ hai bị đội lên rất nhiều. Giá trị client gửi tường minh (ví dụ sau
 * khi thay đồng hồ) vẫn được tôn trọng và kiểm tra như cũ.
 */
export const meterReadingService = {
  createReading: async (
    landlordId: string,
    data: {
      roomId: string;
      month: number;
      year: number;
      electricityStart?: number;
      electricityEnd: number;
      waterStart?: number;
      waterEnd: number;
    },
  ) => {
    const { roomId, month, year, electricityEnd, waterEnd } = data;

    // Check quyền sở hữu phòng
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { property: true }
    });

    if (!room) throw new AppError('Không tìm thấy phòng', 404);
    if (room.property.landlordId !== landlordId) {
      throw new AppError('Bạn không có quyền ghi chỉ số cho phòng này', 403);
    }

    const previous = await prisma.meterReading.findFirst({
      where: {
        roomId,
        OR: [{ year: { lt: year } }, { year, month: { lt: month } }],
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: { electricityEnd: true, waterEnd: true, month: true, year: true },
    });

    const electricityStart = data.electricityStart ?? previous?.electricityEnd ?? 0;
    const waterStart = data.waterStart ?? previous?.waterEnd ?? 0;

    // Không âm, không thập phân: chỉ số đồng hồ là số nguyên. Validation đã chặn
    // phần lớn, nhưng service vẫn kiểm tra lại vì đây là dữ liệu dùng để tính tiền.
    for (const [label, value] of [
      ['điện đầu kỳ', electricityStart],
      ['điện cuối kỳ', electricityEnd],
      ['nước đầu kỳ', waterStart],
      ['nước cuối kỳ', waterEnd],
    ] as const) {
      if (!Number.isInteger(value) || value < 0) {
        throw new AppError(`Chỉ số ${label} phải là số nguyên không âm`, 400, 'READING_INVALID');
      }
    }

    // Chỉ số đầu kỳ do client gửi KHÔNG được thấp hơn chỉ số cuối kỳ trước: làm
    // vậy sẽ tính lại một phần tiêu thụ đã tính ở kỳ trước. Hệ thống không hỗ trợ
    // rollover đồng hồ, nên đây là lỗi dữ liệu — không được đoán.
    if (previous && data.electricityStart !== undefined && data.electricityStart < previous.electricityEnd) {
      throw new AppError(
        `Chỉ số điện đầu kỳ (${data.electricityStart}) nhỏ hơn chỉ số cuối kỳ ${previous.month}/${previous.year} (${previous.electricityEnd})`,
        400,
        'READING_ROLLBACK_NOT_SUPPORTED',
      );
    }
    if (previous && data.waterStart !== undefined && data.waterStart < previous.waterEnd) {
      throw new AppError(
        `Chỉ số nước đầu kỳ (${data.waterStart}) nhỏ hơn chỉ số cuối kỳ ${previous.month}/${previous.year} (${previous.waterEnd})`,
        400,
        'READING_ROLLBACK_NOT_SUPPORTED',
      );
    }

    if (electricityEnd < electricityStart) {
      throw new AppError(
        previous && data.electricityStart === undefined
          ? `Chỉ số điện cuối kỳ (${electricityEnd}) nhỏ hơn chỉ số cuối kỳ ${previous.month}/${previous.year} (${electricityStart})`
          : 'Chỉ số điện cuối kỳ không hợp lệ',
        400,
      );
    }
    if (waterEnd < waterStart) {
      throw new AppError(
        previous && data.waterStart === undefined
          ? `Chỉ số nước cuối kỳ (${waterEnd}) nhỏ hơn chỉ số cuối kỳ ${previous.month}/${previous.year} (${waterStart})`
          : 'Chỉ số nước cuối kỳ không hợp lệ',
        400,
      );
    }

    // Check xem tháng này đã ghi chưa
    const existing = await prisma.meterReading.findUnique({
      where: { roomId_month_year: { roomId, month, year } }
    });
    if (existing) throw new AppError(`Đã ghi nhận chỉ số cho phòng này vào tháng ${month}/${year}`, 400);

    return await prisma.meterReading.create({
      data: { roomId, month, year, electricityStart, electricityEnd, waterStart, waterEnd }
    });
  },

  /** Chỉ số gần nhất của một phòng — dùng để điền sẵn chỉ số đầu kỳ trên UI. */
  getLatest: async (landlordId: string, roomId: string) => {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, property: { select: { landlordId: true } } },
    });
    if (!room || room.property.landlordId !== landlordId) {
      throw new AppError('Không tìm thấy phòng hoặc bạn không có quyền', 404);
    }
    return await prisma.meterReading.findFirst({
      where: { roomId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }
};