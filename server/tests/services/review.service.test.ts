import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { reviewService } from '../../src/services/review.service';

/**
 * ĐÁNH GIÁ (Batch 4) — Prisma mock toàn bộ.
 *
 * Bất biến: chỉ người tham gia + công việc COMPLETED; không tự đánh giá; trùng
 * (P2002) -> 409 chứ không phải 500; điểm trung bình luôn suy ra từ bảng `reviews`.
 */
const mocks = vi.hoisted(() => ({
  taskFindUnique: vi.fn(),
  taskFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  reviewCreate: vi.fn(),
  reviewFindUnique: vi.fn(),
  reviewAggregate: vi.fn(),
  notifyUsers: vi.fn(),
}));

vi.mock('../../src/config/db', () => ({
  default: {
    maintenanceTask: { findUnique: mocks.taskFindUnique, findMany: mocks.taskFindMany },
    user: { findUnique: mocks.userFindUnique },
    review: {
      create: mocks.reviewCreate,
      findUnique: mocks.reviewFindUnique,
      aggregate: mocks.reviewAggregate,
    },
  },
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { notifyUsers: mocks.notifyUsers },
}));

const TASK_ID = 'task-1';
const LANDLORD_ID = 'landlord-1';
const STAFF_ID = 'staff-1';
const OUTSIDER_ID = 'outsider-1';

const taskRow = (overrides: Record<string, unknown> = {}) => ({
  id: TASK_ID,
  landlordId: LANDLORD_ID,
  assignedStaffId: STAFF_ID,
  status: 'COMPLETED',
  title: 'Sửa ống nước',
  ...overrides,
});

const createdReview = {
  id: 'review-1',
  reviewerId: LANDLORD_ID,
  targetType: 'TASK',
  targetId: TASK_ID,
  rating: 5,
  comment: 'Tốt',
  createdAt: new Date(),
  reviewer: { fullName: 'Chủ trọ A', avatarUrl: null },
};

const expectAppError = async (promise: Promise<unknown>, statusCode: number, code?: string) => {
  const matcher: Record<string, unknown> = { statusCode };
  if (code) matcher.code = code;
  await expect(promise).rejects.toMatchObject(matcher);
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.taskFindUnique.mockResolvedValue(taskRow());
  mocks.reviewCreate.mockResolvedValue(createdReview);
  mocks.reviewFindUnique.mockResolvedValue(null);
  mocks.notifyUsers.mockResolvedValue([]);
});


describe('reviewService.createReview — TASK', () => {
  it('công việc chưa COMPLETED -> 409 TASK_NOT_COMPLETED, không ghi', async () => {
    mocks.taskFindUnique.mockResolvedValue(taskRow({ status: 'SUBMITTED' }));

    await expectAppError(
      reviewService.createReview(LANDLORD_ID, { targetType: 'TASK', targetId: TASK_ID, rating: 5 }),
      409,
      'TASK_NOT_COMPLETED',
    );
    expect(mocks.reviewCreate).not.toHaveBeenCalled();
  });

  it('người ngoài không đánh giá được (404, không lộ công việc)', async () => {
    await expect(reviewService.createReview(OUTSIDER_ID, {
      targetType: 'TASK',
      targetId: TASK_ID,
      rating: 4,
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.reviewCreate).not.toHaveBeenCalled();
  });

  it('chủ trọ đánh giá công việc hoàn thành -> lưu TASK review + báo cho thợ', async () => {
    await reviewService.createReview(LANDLORD_ID, {
      targetType: 'TASK',
      targetId: TASK_ID,
      rating: 5,
      comment: 'Tốt',
    });

    expect(mocks.reviewCreate).toHaveBeenCalledWith({
      data: { reviewerId: LANDLORD_ID, targetType: 'TASK', targetId: TASK_ID, rating: 5, comment: 'Tốt' },
      include: { reviewer: { select: { fullName: true, avatarUrl: true } } },
    });
    expect(mocks.notifyUsers).toHaveBeenCalledWith(
      [STAFF_ID],
      expect.objectContaining({ type: 'REVIEW', referenceId: TASK_ID }),
      expect.any(Function),
    );
  });

  it('trùng đánh giá (P2002) -> 409 REVIEW_ALREADY_EXISTS thay vì 500', async () => {
    mocks.reviewCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.19.3' }),
    );

    await expectAppError(
      reviewService.createReview(STAFF_ID, { targetType: 'TASK', targetId: TASK_ID, rating: 4 }),
      409,
      'REVIEW_ALREADY_EXISTS',
    );
    expect(mocks.notifyUsers).not.toHaveBeenCalled();
  });
});

describe('reviewService.createReview — USER', () => {
  it('không thể tự đánh giá chính mình -> 400 SELF_REVIEW_FORBIDDEN', async () => {
    await expectAppError(
      reviewService.createReview(STAFF_ID, { targetType: 'USER', targetId: STAFF_ID, rating: 5 }),
      400,
      'SELF_REVIEW_FORBIDDEN',
    );
    expect(mocks.reviewCreate).not.toHaveBeenCalled();
  });
});

describe('reviewService.getTaskReviewState', () => {
  it('đã đánh giá rồi -> canReview=false, trả cả đánh giá của bên kia', async () => {
    mocks.reviewFindUnique
      .mockResolvedValueOnce({ id: 'mine', rating: 5, comment: null, createdAt: new Date() })
      .mockResolvedValueOnce({ id: 'theirs', rating: 4, comment: 'Ổn', createdAt: new Date() });

    const state = await reviewService.getTaskReviewState(LANDLORD_ID, TASK_ID);

    expect(state.canReview).toBe(false);
    expect(state.myReview?.id).toBe('mine');
    expect(state.counterpartReview?.id).toBe('theirs');
  });

  it('công việc chưa xong -> canReview=false dù chưa đánh giá', async () => {
    mocks.taskFindUnique.mockResolvedValue(taskRow({ status: 'IN_PROGRESS' }));

    const state = await reviewService.getTaskReviewState(STAFF_ID, TASK_ID);

    expect(state.canReview).toBe(false);
  });

  it('người ngoài -> 404', async () => {
    await expect(reviewService.getTaskReviewState(OUTSIDER_ID, TASK_ID)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('reviewService.getStaffRatingSummary', () => {
  it('điểm trung bình suy ra từ bảng reviews của các việc COMPLETED', async () => {
    mocks.taskFindMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
    mocks.reviewAggregate.mockResolvedValue({ _avg: { rating: 4.26 }, _count: { _all: 7 } });

    const summary = await reviewService.getStaffRatingSummary(STAFF_ID);

    expect(mocks.reviewAggregate).toHaveBeenCalledWith({
      where: { targetType: 'TASK', targetId: { in: ['t1', 't2'] } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    expect(summary).toEqual({ averageRating: 4.3, totalReviews: 7 });
  });

  it('thợ chưa có việc hoàn thành -> 0/0, không gọi aggregate', async () => {
    mocks.taskFindMany.mockResolvedValue([]);

    expect(await reviewService.getStaffRatingSummary(STAFF_ID)).toEqual({ averageRating: 0, totalReviews: 0 });
    expect(mocks.reviewAggregate).not.toHaveBeenCalled();
  });
});
