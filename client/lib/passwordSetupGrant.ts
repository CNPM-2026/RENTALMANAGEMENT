/**
 * H-05/Batch 2B1: chuyển "password-setup grant" từ bước xác minh email sang bước
 * đặt mật khẩu — CHỈ trong bộ nhớ của tab hiện tại.
 *
 * Vì sao không dùng URL hay storage:
 *  - `localStorage`/`sessionStorage`: grant là credential, không được sống sót sau
 *    khi dùng xong và không được để bất kỳ script nào đọc lại về sau.
 *  - query string / hash: vào lịch sử trình duyệt, vào log của server (query string)
 *    và vào `Referer` gửi ra ngoài.
 *
 * Vòng đời (H-05/Batch 2B1.1 — F-1): trang `/set-password` ĐỌC grant mà KHÔNG tiêu
 * thụ, nên mount lại trang (back/forward nội bộ, Fast Refresh) trước khi bấm gửi vẫn
 * dùng được grant còn hạn. Grant chỉ bị xóa sau khi server xác nhận đã đặt mật khẩu
 * thành công — lúc đó `authVersion` đã tăng nên grant vĩnh viễn vô hiệu.
 *
 * Hệ quả được chấp nhận: tải lại document (F5/reload) vẫn làm mất grant vì nó chỉ
 * sống trong RAM. Đó là hành vi an toàn đúng — grant đã phát không thể tái tạo nếu
 * không chứng minh lại hộp thư, nên đường khôi phục là `POST /auth/forgot-password`
 * (xem trang `/set-password`).
 */
let pendingGrant: string | null = null;

/** Lưu grant vừa nhận từ `POST /auth/verify-email`. */
export const setPasswordSetupGrant = (grant: string): void => {
  pendingGrant = grant;
};

/**
 * Đọc grant mà KHÔNG tiêu thụ — dùng khi trang `/set-password` mount.
 *
 * H-05/Batch 2B1.1 (F-1): trước đây grant bị xóa ngay lúc mount, nên một lần mount
 * lại (back/forward, Fast Refresh) trước khi submit đã hủy một grant còn hạn và đẩy
 * người dùng sang nhánh "liên kết hết hạn". Grant chỉ thực sự chết khi server đã đặt
 * mật khẩu thành công (`authVersion` tăng) hoặc khi hết TTL 10 phút.
 */
export const peekPasswordSetupGrant = (): string | null => pendingGrant;

/**
 * Xóa grant khỏi RAM. CHỈ gọi sau khi `POST /auth/password/set` trả về thành công
 * (từ đó grant đã vô hiệu ở phía server, giữ lại chỉ tạo cảm giác dùng lại được).
 *
 * Không gọi trên nhánh lỗi: lỗi mạng, hết hạn hay sai mật khẩu không được biến một
 * lần thử lại hợp lệ thành "liên kết không còn hiệu lực" ở phía client.
 */
export const clearPasswordSetupGrant = (): void => {
  pendingGrant = null;
};
