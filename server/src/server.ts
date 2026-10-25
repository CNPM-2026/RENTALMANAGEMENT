import dotenv from 'dotenv';
dotenv.config(); // Load biến môi trường

import app from './app';
import prisma from './config/db';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Test kết nối Database
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL via Prisma');

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();