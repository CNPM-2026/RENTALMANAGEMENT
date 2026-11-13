import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import prisma from '../config/db';
import { verifyToken } from '../utils/jwt';
import { setIoInstance } from './socket.instance'; // Thêm import
import { SESSION_REJECTED_MESSAGE } from './sessionInvalidation';
import { env } from '../config/env';
import { chatService } from '../services/chat.service';
import { AppError } from '../utils/AppError';

// Mở rộng kiểu dữ liệu của Socket để lưu thông tin user
interface AuthSocket extends Socket {
  user?: { id: string; role: string };
  /**
   * H-05/Batch 2B2.1: `authVersion` đã được kiểm chứng với DB TẠI HANDSHAKE.
   * Đây là dữ liệu phía server (không phải client gửi lên), dùng làm mốc so sánh
   * "phiên bản mà kết nối này được cấp" với "phiên bản hiện tại trong DB".
   */
  data: { authVersion?: number };
}

/**
 * H-05/Batch 2B2.1 (finding L1 — phiên WebSocket không bị vô hiệu hóa):
 *
 * Handshake chỉ chứng minh danh tính tại THỜI ĐIỂM kết nối. Mọi mutation làm tăng
 * `users.auth_version` (đặt/đặt lại mật khẩu, password-setup grant, Google claim,
 * khóa/mở tài khoản) xảy ra SAU đó sẽ khiến một socket đang mở mang danh tính cũ
 * mà vẫn tiếp tục nhận event. Vì vậy mỗi event do client gửi lên đều phải được
 * kiểm chứng lại với DB (xem `socket.use` bên dưới).
 *
 * Chỉ đọc đúng hai cột cần thiết và luôn đọc từ DB, không cache, không timer,
 * không polling: nhờ vậy không tồn tại khoảng thời gian nào mà socket còn giữ
 * quyền sau khi trạng thái bảo mật đã đổi.
 */
const loadSocketSessionState = (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, authVersion: true },
  });

/**
 * Từ chối một event đến từ socket đã stale: trả lời theo đúng quy ước ack hiện có
 * của client (`{ success, message }` — xem `send_message`), báo lỗi qua
 * `error_message` như mọi lỗi chat khác, rồi đóng kết nối.
 *
 * `disconnect(true)` đóng luôn Engine.IO connection nên client nhận lý do
 * "io server disconnect" và KHÔNG tự reconnect bằng token cũ; kết nối chỉ được mở
 * lại khi UI gọi `socket.connect()` sau khi `refreshChatSocketAuth()` lấy token mới.
 *
 * KHÔNG dùng `next(new Error(...))`: socket.io sẽ gửi gói ERROR, và phía client
 * không có listener cho event `error` dự phòng nên sẽ ném lỗi không bắt được.
 * Việc KHÔNG gọi `next` khiến handler nghiệp vụ không bao giờ chạy
 * (`Socket#run`: chỉ dispatch khi middleware cuối gọi `next()`).
 */
const rejectStaleSocket = (socket: AuthSocket, eventArgs: unknown[]) => {
  // Event khác đã đóng socket này rồi: không còn gì để trả lời.
  if (!socket.connected) return;

  const acknowledge = eventArgs[eventArgs.length - 1];
  if (typeof acknowledge === 'function') {
    (acknowledge as (result: { success: false; message: string }) => void)({
      success: false,
      message: SESSION_REJECTED_MESSAGE,
    });
  }
  socket.emit('error_message', SESSION_REJECTED_MESSAGE);
  socket.disconnect(true);
};

export const initSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: { origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()), methods: ['GET', 'POST'] },
  });
  setIoInstance(io); 
  // Middleware: Xác thực token trước khi cho phép kết nối
  io.use(async (socket: AuthSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error: Token required'));

    try {
      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, isActive: true, authVersion: true },
      });
      if (!user?.isActive) return next(new Error('Authentication error: User is inactive'));
      // H-05/Batch 2B2: cùng bất biến với `authenticate` — access token mang
      // `authVersion` cũ (sau đặt/đặt lại mật khẩu, Google claim, khóa/mở tài
      // khoản) không được mở socket.
      if (decoded.av !== user.authVersion) return next(new Error('Authentication error: Invalid token'));
      socket.user = { id: user.id, role: user.role }; // Lưu id và role vào socket
      // H-05/Batch 2B2.1: ghi lại phiên bản ĐÃ kiểm chứng để mỗi event so lại với
      // DB. Giá trị lấy từ row users vừa đọc, không lấy từ token/client.
      socket.data.authVersion = user.authVersion;
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

    // H-05/Batch 2B2.1 (finding L1): kiểm chứng lại phiên TRƯỚC mỗi event của client.
    // Handshake chỉ là ảnh chụp tại thời điểm kết nối, nên socket đang mở vẫn có thể
    // mang `authVersion` cũ (hoặc user vừa bị khóa) sau đó. Middleware này áp dụng cho
    // MỌI event client gửi lên — kể cả event được thêm sau này — nên không có đường
    // vòng nào tới handler nghiệp vụ, và chỉ đọc DB đúng một lần cho mỗi event.
    socket.use(async ([, ...eventArgs], next) => {
      if (!userId) {
        // Không xác định được danh tính (không xảy ra sau handshake): fail closed.
        rejectStaleSocket(socket, eventArgs);
        return;
      }

      try {
        const state = await loadSocketSessionState(userId);
        if (state?.isActive && state.authVersion === socket.data.authVersion) {
          next();
          return;
        }
      } catch (error) {
        // Fail closed: lỗi DB không bao giờ được hiểu thành "phiên vẫn hợp lệ".
        console.error('Không thể kiểm chứng phiên socket:', error);
      }

      // Không gọi `next()`: handler nghiệp vụ của event này không được thực thi.
      rejectStaleSocket(socket, eventArgs);
    });

    // Sự kiện: Join vào phòng chat cụ thể
    socket.on('join_conversation', async (conversationId: string) => {
      if (!userId || typeof conversationId !== 'string') return;
      const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId } }
      });
      if (!member) return socket.emit('error_message', 'Bạn không thuộc cuộc trò chuyện này');
      socket.join(`conversation_${conversationId}`);
      console.log(`User ${userId} joined room: ${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      if (typeof conversationId === 'string') socket.leave(`conversation_${conversationId}`);
    });

    // Gửi tin nhắn: toàn bộ việc ghi DB + phát realtime nằm trong `chatService`
    // (một nguồn duy nhất, dùng chung với route HTTP có tệp đính kèm).
    socket.on('send_message', async (
      data: { conversationId: string; content: string; messageType?: string; clientMessageId?: string },
      acknowledge?: (result: { success: boolean; message?: string; messageId?: string }) => void,
    ) => {
      try {
        if (!userId) return acknowledge?.({ success: false, message: 'Phiên đăng nhập không hợp lệ' });
        if (typeof data?.conversationId !== 'string') {
          acknowledge?.({ success: false, message: 'Hội thoại không hợp lệ' });
          return socket.emit('error_message', 'Hội thoại không hợp lệ');
        }

        const message = await chatService.sendMessage(userId, data.conversationId, {
          content: typeof data.content === 'string' ? data.content : '',
          messageType: data.messageType === 'SYSTEM' ? 'TEXT' : (data.messageType as 'TEXT' | 'IMAGE' | 'FILE') ?? 'TEXT',
          clientMessageId: typeof data.clientMessageId === 'string' ? data.clientMessageId : undefined,
        });

        acknowledge?.({ success: true, messageId: message.id });
      } catch (error) {
        const reason = error instanceof AppError ? error.message : 'Không thể gửi tin nhắn';
        acknowledge?.({ success: false, message: reason });
        socket.emit('error_message', reason);
      }
    });


    // Sự kiện: Đang gõ phím (Typing)
    socket.on('typing', async (data: { conversationId: string; isTyping: boolean }) => {
      if (!userId || typeof data?.conversationId !== 'string' || typeof data.isTyping !== 'boolean') return;
      const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: data.conversationId, userId } }
      });
      if (!member) return socket.emit('error_message', 'Bạn không thuộc cuộc trò chuyện này');
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