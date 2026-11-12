import { Server } from 'socket.io';

// Biến lưu instance io toàn cục
export let io: Server;

// Hàm này được gọi 1 lần duy nhất ở server.ts để gán giá trị
export const setIoInstance = (instance: Server) => {
  io = instance;
};

/**
 * Đọc instance io hiện tại mà KHÔNG ném lỗi khi Socket.IO chưa được khởi tạo
 * (test, script CLI, tiến trình worker, HTTP server chưa listen).
 *
 * Trả về `undefined` thay vì `io` trực tiếp để nơi gọi (xem
 * `sessionInvalidation.ts`) fail-safe: chưa có socket layer thì không có socket
 * nào cần đóng, và một mutation vẫn không được phép thất bại vì lý do đó.
 */
export const getIoInstance = (): Server | undefined => io;
