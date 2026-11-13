import { NextFunction, Response } from 'express';
import { contractService } from '../services/contract.service';
import { contractLifecycleService } from '../services/contractLifecycle.service';
import { AuthRequest, resourceOwnerId } from '../middlewares/auth.middleware';
import { ContractRenewalStatus, ContractStatus, ContractTerminationStatus } from '@prisma/client';

/** Nhân viên được cấp quyền thao tác dưới danh nghĩa chủ trọ đã cấp quyền. */
const isStaffScope = (req: AuthRequest) => Boolean(req.user!.landlordId);

const uploadedFiles = (req: AuthRequest): Express.Multer.File[] =>
  Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];

const lifecycleActor = (req: AuthRequest) => ({
  id: req.user!.id,
  role: req.user!.role,
});

export const contractController = {
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await contractService.createContract(resourceOwnerId(req), req.body);
      return res.status(201).json({
        success: true,
        message: 'Tạo hợp đồng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getMyContracts: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await contractService.getMyContracts(
        resourceOwnerId(req),
        isStaffScope(req) ? 'LANDLORD' : req.user!.role,
      );
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách hợp đồng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  updateStatus: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      const result = await contractService.updateStatus(resourceOwnerId(req), String(req.params.id), status as ContractStatus);
      return res.status(200).json({
        success: true,
        message: 'Cập nhật trạng thái hợp đồng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  createTerminationRequest: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await contractLifecycleService.createTerminationRequest(
        lifecycleActor(req),
        String(req.params.id),
        req.body,
        uploadedFiles(req),
      );
      return res.status(201).json({
        success: true,
        message: 'Đã gửi yêu cầu chấm dứt hợp đồng, đang chờ Admin duyệt',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getTerminationRequests: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await contractLifecycleService.getTerminationRequests(
        lifecycleActor(req),
        req.query.status as ContractTerminationStatus | undefined,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  reviewTerminationRequest: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await contractLifecycleService.reviewTerminationRequest(
        lifecycleActor(req),
        String(req.params.requestId),
        req.body,
      );
      return res.status(200).json({
        success: true,
        message: 'Đã xử lý yêu cầu chấm dứt hợp đồng',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  confirmDepositRefund: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await contractLifecycleService.confirmDepositRefund(
        req.user!.id,
        String(req.params.requestId),
      );
      return res.status(200).json({
        success: true,
        message: 'Đã xác nhận hoàn tiền cọc',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  createRenewalRequest: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await contractLifecycleService.createRenewalRequest(
        lifecycleActor(req),
        String(req.params.id),
        req.body,
      );
      return res.status(201).json({
        success: true,
        message: 'Đã gửi đề xuất ký tiếp hợp đồng',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getRenewalRequests: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await contractLifecycleService.getRenewalRequests(
        lifecycleActor(req),
        req.query.status as ContractRenewalStatus | undefined,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  respondRenewalRequest: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await contractLifecycleService.respondRenewalRequest(
        lifecycleActor(req),
        String(req.params.requestId),
        req.body,
      );
      return res.status(200).json({
        success: true,
        message: 'Đã phản hồi đề xuất ký tiếp hợp đồng',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },
};