import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import prisma from '../config/db';
import { verifyToken } from '../utils/jwt';

// Mở rộng kiểu dữ liệu của Socket để lưu thông tin user
interface AuthSocket extends Socket {
  user?: { id: string; role: string };
}

export const initSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Middleware: Xác thực token trước khi cho phép kết nối
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error: Token required'));

    try {
      const decoded = verifyToken(token);
      socket.user = decoded; // Lưu id và role vào socket
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.user?.id;
    console.log(`🔌 User connected: ${userId}`);
    
    // Cho user join vào 1 room riêng của chính họ (để sau này gửi thông báo cá nhân)
    if (userId) socket.join(`user_${userId}`);

    // Sự kiện: Join vào phòng chat cụ thể
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`User ${userId} joined room: ${conversationId}`);
    });

    // Sự kiện: Gửi tin nhắn
    socket.on('send_message', async (data: { conversationId: string; content: string; messageType?: string }) => {
      try {
        const { conversationId, content, messageType = 'TEXT' } = data;
        if (!userId) return;

        // 1. Lưu tin nhắn vào Database (Prisma)
        const newMessage = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            content,
            messageType: messageType as any,
          },
          include: {
            sender: { select: { fullName: true, avatarUrl: true } }
          }
        });

        // 2. Cập nhật thời gian updatedAt của Conversation để nó nổi lên đầu danh sách
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        // 3. Phát tin nhắn tới tất cả những ai đang ở trong phòng chat này (kể cả người gửi)
        io.to(`conversation_${conversationId}`).emit('receive_message', newMessage);

      } catch (error) {
        socket.emit('error_message', 'Không thể gửi tin nhắn');
      }
    });

    // Sự kiện: Đang gõ phím (Typing)
    socket.on('typing', (data: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
        userId,
        isTyping: data.isTyping
      });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${userId}`);
    });
  });

  return io;
};