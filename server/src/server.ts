import dotenv from 'dotenv';
dotenv.config();

import http from 'http'; // Thêm import
import app from './app';
import prisma from './config/db';
import { initSocket } from './socket'; // Import hàm initSocket

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL via Prisma');

    // Tạo HTTP server từ app Express
    const server = http.createServer(app);

    // Khởi tạo Socket.io và gắn vào server
    initSocket(server);

    // Chạy server (Lưu ý: dùng server.listen thay vì app.listen)
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();