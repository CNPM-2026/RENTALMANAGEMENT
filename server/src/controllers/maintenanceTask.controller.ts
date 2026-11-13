import { NextFunction, Response } from 'express';
import type { MaintenanceTaskStatus } from '@prisma/client';
import { AuthRequest, resourceOwnerId } from '../middlewares/auth.middleware';
import { maintenanceTaskService } from '../services/maintenanceTask.service';
import { maintenanceApplicationService } from '../services/maintenanceApplication.service';
import { maintenanceWorkflowService } from '../services/maintenanceWorkflow.service';
import { maintenanceOfferService } from '../services/maintenanceOffer.service';
import type { MaintenanceOfferDecisionInput, MaintenanceOfferProposeInput } from '../validations/maintenanceOffer.validation';
import type {
  MaintenanceCompletionConfirmInput,
  MaintenanceCompletionRejectInput,
  MaintenanceTaskCompletionInput,
} from '../validations/maintenanceTask.validation';

/** Multer trả `req.files` dạng mảng với `upload.array()`; chuẩn hoá tại một chỗ. */
const uploadedFiles = (req: AuthRequest): Express.Multer.File[] =>
  Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];

/**
 * Nhân viên được chủ trọ cấp quyền thao tác dưới danh nghĩa chủ trọ:
 * `resourceOwnerId` trả về id chủ trọ, vai trò hiệu lực là LANDLORD. Nhờ vậy
 * mọi kiểm tra sở hữu trong service vẫn chạy đúng, và nhân viên không thể thao
 * tác việc của chủ trọ khác.
 */
const scopeRole = (req: AuthRequest) => (req.user!.landlordId ? 'LANDLORD' : req.user!.role);

export const maintenanceTaskController = {
  // --- Chủ trọ ---
  getMine: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED' | 'CANCELLED' | undefined;
      return res.json({ success: true, data: await maintenanceTaskService.getMine(resourceOwnerId(req), { status }) });
    } catch (error) {
      return next(error);
    }
  },

  update: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const task = await maintenanceTaskService.update(
        resourceOwnerId(req),
        String(req.params.id),
        req.body,
        uploadedFiles(req),
      );
      return res.json({ success: true, message: 'Đã cập nhật công việc', data: task });
    } catch (error) {
      return next(error);
    }
  },

  cancel: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã huỷ công việc',
        data: await maintenanceTaskService.cancel(resourceOwnerId(req), String(req.params.id)),
      });
    } catch (error) {
      return next(error);
    }
  },

  // --- Dùng chung (phạm vi dữ liệu do service quyết định) ---
  getById: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await maintenanceTaskService.getById(
        { id: resourceOwnerId(req), role: scopeRole(req) },
        String(req.params.id),
      );
      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  },

  // --- Thợ ---
  /**
   * GET chỉ dành cho filter KHÔNG nhạy cảm.
   *
   * Không đọc `latitude`/`longitude`/`radiusKm` từ `req.query`: URL có thể bị
   * ghi vào access log, browser history hoặc referer. Tìm việc gần đây dùng
   * `browseOpenByLocation` (POST).
   */
  browseOpen: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = req.query as MaintenanceTaskBrowseSource;
      const result = await maintenanceTaskService.browseOpen(
        req.user!.id,
        baseTaskBrowseInput(query),
      );
      return res.json({ success: true, data: result.items, meta: result.meta });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * POST body cho filter có dữ liệu vị trí nhạy cảm.
   *
   * Chỉ đọc `req.body`; không fallback sang `req.query` cho geo — fallback sẽ
   * tái tạo đúng luồng dữ liệu mà CodeQL cảnh báo.
   */
  browseOpenByLocation: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body as MaintenanceTaskBrowseSource;
      const result = await maintenanceTaskService.browseOpen(
        req.user!.id,
        taskBrowseInputWithLocation(body),
      );
      return res.json({ success: true, data: result.items, meta: result.meta });
    } catch (error) {
      return next(error);
    }
  },

  apply: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const application = await maintenanceApplicationService.apply(
        req.user!.id,
        String(req.params.id),
        req.body,
      );
      return res.status(201).json({ success: true, message: 'Đã gửi đơn ứng tuyển', data: application });
    } catch (error) {
      return next(error);
    }
  },

  withdraw: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã rút đơn ứng tuyển',
        data: await maintenanceApplicationService.withdraw(req.user!.id, String(req.params.id)),
      });
    } catch (error) {
      return next(error);
    }
  },

  listMyApplications: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        data: await maintenanceApplicationService.listMine(req.user!.id),
      });
    } catch (error) {
      return next(error);
    }
  },

  // --- Thợ: thực thi công việc đã được giao (Batch 3) ---
  /**
   * Danh sách việc ĐÃ GIAO cho chính thợ đang đăng nhập. `staffId` lấy từ token;
   * client không truyền được id của thợ khác.
   */
  listAssigned: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as MaintenanceTaskStatus | undefined;
      return res.json({
        success: true,
        data: await maintenanceWorkflowService.listAssigned(req.user!.id, { status }),
      });
    } catch (error) {
      return next(error);
    }
  },

  startWork: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã bắt đầu công việc',
        data: await maintenanceWorkflowService.start(req.user!.id, String(req.params.id)),
      });
    } catch (error) {
      return next(error);
    }
  },

  submitCompletion: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã gửi nghiệm thu, chờ chủ trọ xác nhận',
        data: await maintenanceWorkflowService.submitCompletion(
          req.user!.id,
          String(req.params.id),
          req.body as MaintenanceTaskCompletionInput,
          uploadedFiles(req),
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  confirmCompletion: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã xác nhận hoàn thành công việc',
        data: await maintenanceWorkflowService.confirmCompletion(
          resourceOwnerId(req),
          String(req.params.id),
          req.body as MaintenanceCompletionConfirmInput,
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  rejectCompletion: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã yêu cầu thợ làm lại',
        data: await maintenanceWorkflowService.rejectCompletion(
          resourceOwnerId(req),
          String(req.params.id),
          req.body as MaintenanceCompletionRejectInput,
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  // --- Chủ trọ xử lý đơn ---
  listApplications: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        data: await maintenanceApplicationService.listForTask(resourceOwnerId(req), String(req.params.id)),
      });
    } catch (error) {
      return next(error);
    }
  },

  acceptApplication: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã giao việc cho thợ',
        data: await maintenanceApplicationService.accept(
          resourceOwnerId(req),
          String(req.params.id),
          String(req.params.applicationId),
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  rejectApplication: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã từ chối đơn ứng tuyển',
        data: await maintenanceApplicationService.reject(
          resourceOwnerId(req),
          String(req.params.id),
          String(req.params.applicationId),
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  // --- 🆕 Batch 3: thương lượng giá (chủ trọ và thợ được giao) ---------------
  getOffers: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        data: await maintenanceOfferService.list(req.user!.id, String(req.params.id)),
      });
    } catch (error) {
      return next(error);
    }
  },

  proposeOffer: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.status(201).json({
        success: true,
        message: 'Đã gửi đề xuất giá',
        data: await maintenanceOfferService.propose(
          req.user!.id,
          String(req.params.id),
          req.body as MaintenanceOfferProposeInput,
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  acceptOffer: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã chấp nhận đề xuất giá',
        data: await maintenanceOfferService.respond(
          req.user!.id,
          String(req.params.id),
          String(req.params.offerId),
          'ACCEPT',
          req.body as MaintenanceOfferDecisionInput,
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  rejectOffer: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã từ chối đề xuất giá',
        data: await maintenanceOfferService.respond(
          req.user!.id,
          String(req.params.id),
          String(req.params.offerId),
          'REJECT',
          req.body as MaintenanceOfferDecisionInput,
        ),
      });
    } catch (error) {
      return next(error);
    }
  },

  withdrawOffer: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        message: 'Đã rút đề xuất giá',
        data: await maintenanceOfferService.withdraw(
          req.user!.id,
          String(req.params.id),
          String(req.params.offerId),
          {},
        ),
      });
    } catch (error) {
      return next(error);
    }
  },
};

type MaintenanceTaskBrowseSource = {
  category?: string;
  skill?: string;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
  search?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  radiusKm?: string | number | null;
  sort?: 'newest' | 'nearest' | 'urgency';
  page?: string | number;
  limit?: string | number;
};

/** Filter thường — an toàn cho cả GET query và POST body. */
function baseTaskBrowseInput(source: MaintenanceTaskBrowseSource) {
  return {
    category: source.category as never,
    skill: source.skill as never,
    urgency: source.urgency as never,
    search: source.search,
    sort: source.sort as never,
    page: toPositiveInt(source.page) ?? undefined,
    limit: toPositiveInt(source.limit) ?? undefined,
  };
}

/**
 * Filter có geo — CHỈ gọi với `req.body` từ route POST.
 * Giữ `toOptionalNumber` để `''`/dữ liệu lỗi không âm thầm thành 0.
 */
function taskBrowseInputWithLocation(source: MaintenanceTaskBrowseSource) {
  return {
    ...baseTaskBrowseInput(source),
    latitude: toOptionalNumber(source.latitude),
    longitude: toOptionalNumber(source.longitude),
    radiusKm: toOptionalNumber(source.radiusKm),
  };
}

/** Query string luôn là chuỗi: `''`/không phải số -> `undefined` (không thành 0). */
function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toPositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
