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
        createdAt: true,
        updatedAt: true,
        profile: true,
      }
    });

    if (!user || !user.isActive) {
      throw new AppError('Tài khoản không tồn tại hoặc đã bị khóa', 401);
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
      ...user,
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
        createdAt: true,
        updatedAt: true,
        profile: true,
      },
    });

    if (user && user.isActive) {
      authReq.user = user;
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