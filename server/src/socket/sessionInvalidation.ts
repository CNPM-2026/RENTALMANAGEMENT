import prisma from '../config/db';
import { getIoInstance } from './socket.instance';

/**
 * H-05/Batch 2B2.2 (finding L1 — phần "passive invalidation").
 *
 * Vì sao cần module này:
 *  - `socket.use` trong `socket/index.ts` chỉ chặn được event do CLIENT gửi. Một
 *    socket mang `authVersion` cũ (hoặc vừa bị khóa tài khoản) mà không gửi gì thì
 *    vẫn nằm trong room và vẫn NHẬN được broadcast (tin nhắn, thông báo).
 *  - Vì vậy, sau khi một mutation bảo mật COMMIT, các socket đang mở của user đó
 *    phải bị đóng ngay tại thời điểm đó — không chờ tới event kế tiếp.
 *
 * Cơ chế: dùng đúng room cá nhân mà mỗi socket đã join lúc handshake
 * (`user_${userId}` — xem `socket/index.ts`), nên cover MỌI thiết bị/tab của cùng
 * một user mà không cần thêm registry, không cần lưu state, và không có cache nào
 * có thể giữ quyền cũ. `disconnectSockets(true)` đóng luôn Engine.IO connection.
 *
 * Bất biến bắt buộc ở nơi gọi: hàm này CHỈ được gọi SAU khi transaction đã commit
 * (không bao giờ bên trong callback `$transaction`, không bao giờ trước commit),
 * để một lần rollback không thể đá phiên hợp lệ.
 */

/** Trùng nghĩa với 401 của HTTP: không tiết lộ tài khoản tồn tại hay lý do cụ thể. */
export const SESSION_REJECTED_MESSAGE = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn';

/**
 * Đóng mọi socket đang mở của `userId` sau một mutation bảo mật đã commit.
 *
 * - Không có socket layer đang chạy (test/script/chưa init) ⇒ no-op an toàn.
 * - Báo bằng `error_message` (đúng quy ước lỗi hiện có của chat) TRƯỚC khi đóng,
 *   để client biết vì sao mất realtime; sau đó mới disconnect.
 * - `userId` luôn là id server-side (lấy từ row DB vừa cập nhật), không từ client.
 */
export const invalidateUserSockets = (userId: string): void => {
  const server = getIoInstance();
  // Không có io ⇒ không có socket nào để đóng (vd. đang chạy test service).
  if (!server) return;

  const room = `user_${userId}`;
  server.to(room).emit('error_message', SESSION_REJECTED_MESSAGE);
  server.in(room).disconnectSockets(true);
};

/**
 * H-05/Batch 2B2.3 (finding L1.2-a — đăng xuất không đóng WebSocket).
 *
 * `logout` cố ý chỉ thu hồi `refresh_tokens` và KHÔNG đọc/khóa `users`, nên access
 * token — và do đó socket đang mở — vẫn "hợp lệ" tới khi hết hạn. Hàm này đóng các
 * socket đó ngay sau khi việc thu hồi token đã COMMIT.
 *
 * Chủ sở hữu socket được tra từ CHÍNH row `refresh_tokens` (dữ liệu server-side,
 * không bao giờ từ payload): nơi gọi chỉ truyền `tokenHash` của token VỪA được thu
 * hồi thành công. Nhờ vậy token không tồn tại / đã bị thu hồi / đã rotate xong không
 * thể được dùng để đá phiên của người khác.
 *
 * Bất biến khoá: ở đây chỉ SELECT `refresh_tokens` (không khóa) rồi mới chạm socket
 * layer, nên KHÔNG tạo phụ thuộc khóa `refresh_tokens -> users`; thứ tự khóa toàn cục
 * vẫn là `users -> refresh_tokens`.
 *
 * Fail-soft: token đã bị thu hồi và COMMIT xong, nên lỗi ở bước realtime không được
 * biến một lần đăng xuất thành công (204) thành 500.
 */
export const invalidateSocketsForRefreshToken = async (tokenHash: string): Promise<void> => {
  // Không có socket layer (test/script/chưa init) ⇒ không có socket nào để đóng, và
  // cũng không cần đọc DB.
  if (!getIoInstance()) return;

  try {
    const owner = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });
    if (owner) invalidateUserSockets(owner.userId);
  } catch (error) {
    console.error('Không thể vô hiệu hóa socket khi đăng xuất:', error);
  }
};
