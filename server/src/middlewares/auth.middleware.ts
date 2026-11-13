import { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/db';
import { AppError } from '../utils/AppError';

// Mở rộng interface Request của Express để thêm req.user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    avatarUrl: string | null;
    role: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    profile?: {
      id: string;
      userId: string;
      gender: string | null;
      dob: Date | null;
      bio: string | null;
      occupation: string | null;
      emergencyContact: string | null;
      createdAt: Date;
    } | null;
    landlordId?: string;
    staffPermissions?: string[];
  };
}

export const authenticate: RequestHandler = async (req, res, next) => {
  const authReq = req as AuthRequest;
  try {
    // Lấy token từ Header: Authorization: Bearer <token>
    const authHeader = authReq.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Bạn chưa đăng nhập', 401);
    }

    const token = authHeader.split(' ')[1];
    // Ném 401 nếu thiếu/sai claim (`av`, `typ`, `id`, `role`) hoặc sai chữ ký/thuật
    // toán; đây là điều kiện cần để `av` bên dưới có nghĩa.
    const decoded = verifyToken(token);

    // Lấy user từ DB (để check xem user có bị khóa không)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        authVersion: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      }
    });

    if (!user || !user.isActive) {
      throw new AppError('Tài khoản không tồn tại hoặc đã bị khóa', 401);
    }

    // H-05/Batch 2B2: token phải mang đúng `authVersion` hiện tại thì mới còn giá
    // trị. `authVersion` được đọc từ CHÍNH row `users` ở trên nên không phát sinh
    // thêm truy vấn, và được tách khỏi `req.user` để hình dạng request giữ nguyên.
    // Dùng chung thông điệp với token hết hạn: response không tiết lộ account có
    // tồn tại hay vì sao token bị từ chối, và client vẫn đi đúng nhánh refresh 401.
    const { authVersion, ...authorizedUser } = user;
    if (decoded.av !== authVersion) {
      throw new AppError('Phiên đăng nhập đã hết hạn', 401);
    }

    if (!user.isEmailVerified) {
      throw new AppError('Vui lòng xác minh email trước khi sử dụng hệ thống', 403);
    }

    // A landlord account always owns its own resources. Staff context is only
    // resolved for non-landlord users, so another landlord cannot be scoped
    // into a different owner's data by an incidental membership row.
    const staff = user.role === 'LANDLORD'
      ? null
      : await prisma.staffMembership.findFirst({
          where: { userId: user.id, isActive: true },
          select: { landlordId: true, permissions: true },
          orderBy: { createdAt: 'desc' },
        });
    authReq.user = {
      ...authorizedUser,
      landlordId: staff?.landlordId,
      staffPermissions: staff?.permissions,
    };
    next();
  } catch (error: any) {
    if (error?.name === 'TokenExpiredError') {
      return next(new AppError('Phiên đăng nhập đã hết hạn', 401));
    }
    if (error?.name === 'JsonWebTokenError' || error?.name === 'NotBeforeError') {
      return next(new AppError('Token không hợp lệ', 401));
    }
    next(error);
  }
};

export const authenticateOptional: RequestHandler = async (req, res, next) => {
  const authReq = req as AuthRequest;
  try {
    const authHeader = authReq.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        authVersion: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
    });

    // H-05/Batch 2B2: token stale/có `av` sai KHÔNG bao giờ được chuyển thành danh
    // tính tin cậy — request tiếp tục như khách ẩn danh, đúng ngữ nghĩa "optional".
    // Không có token cũng vẫn ẩn danh như trước.
    if (user && user.isActive && decoded.av === user.authVersion) {
      const { authVersion: _currentAuthVersion, ...authorizedUser } = user;
      authReq.user = authorizedUser;
    }
    return next();
  } catch {
    return next();
  }
};

// Middleware phân quyền
export const authorize = (...roles: string[]): RequestHandler => {
  return (req, res, next) => {
    const authReq = req as AuthRequest;
    const role = authReq.user?.role?.toUpperCase();
    const allowedRoles = roles.map((item) => item.toUpperCase());
    const isAdminAlias = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const isAllowed = allowedRoles.includes(role ?? '') || (isAdminAlias && allowedRoles.includes('ADMIN'));
    if (!authReq.user || !isAllowed) {
      return next(new AppError('Bạn không có quyền thực hiện hành động này', 403));
    }
    next();
  };
};

export const authorizeStaff = (permission: string): RequestHandler => {
  return (req, res, next) => {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    if (!user || (user.role !== 'LANDLORD' && !user.staffPermissions?.includes(permission))) {
      return next(new AppError('Bạn không có quyền thực hiện hành động này', 403));
    }
    next();
  };
};

/**
 * Cho phép chủ trọ HOẶC bất kỳ nhân viên nào đang có membership hiệu lực, không
 * phụ thuộc một quyền cụ thể. Dùng cho dữ liệu tổng hợp mà mọi nhân viên đều
 * cần thấy (ví dụ thống kê tổng quan của chủ trọ).
 */
export const authorizeStaffAny = (): RequestHandler => {
  return (req, res, next) => {
    const user = (req as AuthRequest).user;
    const role = user?.role?.toUpperCase();
    const isAdminAlias = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const isMember = !!user && Array.isArray(user.staffPermissions);
    if (!user || (!isAdminAlias && user.role !== 'LANDLORD' && !isMember)) {
      return next(new AppError('Bạn không có quyền thực hiện hành động này', 403));
    }
    next();
  };
};

export const authorizeStaffOr = (permission: string, ...roles: string[]): RequestHandler => {
  return (req, res, next) => {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const isRegularRole = !!user && !user.landlordId && roles.includes(user.role);
    if (!user || (!isRegularRole && user.role !== 'LANDLORD' && !user.staffPermissions?.includes(permission))) {
      return next(new AppError('Bạn không có quyền thực hiện hành động này', 403));
    }
    next();
  };
};

export const resourceOwnerId = (req: AuthRequest): string =>
  req.user!.role === 'LANDLORD' ? req.user!.id : (req.user!.landlordId ?? req.user!.id);