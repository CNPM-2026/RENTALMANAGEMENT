import { Server } from 'socket.io';

// Biến lưu instance io toàn cục
export let io: Server;

// Hàm này được gọi 1 lần duy nhất ở server.ts để gán giá trị
export const setIoInstance = (instance: Server) => {
  io = instance;
};