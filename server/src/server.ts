import 'express-async-errors'; // BẮT BUỘC phải ở trên cùng để tự động bắt lỗi async
import { env } from './config/env'; // Dùng env đã validate
import http from 'http';
import app from './app';
import prisma from './config/db';
import { initSocket } from './socket'; 

const startServer = async () => {
  try {
    // 1. Kết nối Database
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL via Prisma');

    // 2. Tạo HTTP Server và gắn Socket.io
    const server = http.createServer(app);
    initSocket(server); // <--- ĐÂY RỒI, KHÔNG QUÊN ĐÂU NHÉ =))

    // 3. Khởi chạy Server
    server.listen(env.PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
    });

    // 4. Xử lý tắt Server an toàn (Graceful Shutdown)
    // Khi fen bấm Ctrl+C, server sẽ đợi các request đang chạy xong mới tắt, tránh lỗi DB
    const gracefulShutdown = async () => {
      console.log('\n🛑 Đang tắt server...');
      await prisma.$disconnect();
      server.close(() => {
        console.log('✅ Đã ngắt kết nối DB và đóng server an toàn.');
        process.exit(0);
      });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();