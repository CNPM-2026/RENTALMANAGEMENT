import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthRequest } from '../../src/middlewares/auth.middleware';

/**
 * Chống hồi quy cho cảnh báo CodeQL "Sensitive data read from GET request":
 * controller GET KHÔNG được đọc/forward dữ liệu nhạy cảm (`latitude`,
 * `longitude`, `radiusKm`, `lat`, `lng`, `radius`, `gender`) từ `req.query`;
 * các trường này chỉ được lấy từ `req.body` của route POST.
 */
const mocks = vi.hoisted(() => ({
  taskBrowseOpen: vi.fn(),
  staffBrowse: vi.fn(),
  matchingPosts: vi.fn(),
  postSearch: vi.fn(),
}));

vi.mock('../../src/services/maintenanceTask.service', () => ({
  maintenanceTaskService: { browseOpen: mocks.taskBrowseOpen },
}));
vi.mock('../../src/services/maintenanceApplication.service', () => ({
  maintenanceApplicationService: {},
}));
vi.mock('../../src/services/maintenanceWorkflow.service', () => ({
  maintenanceWorkflowService: {},
}));
vi.mock('../../src/services/maintenanceOffer.service', () => ({
  maintenanceOfferService: {},
}));
vi.mock('../../src/services/staffProfile.service', () => ({
  staffProfileService: { browse: mocks.staffBrowse },
}));
vi.mock('../../src/services/matching.service', () => ({
  matchingService: { getRoommatePosts: mocks.matchingPosts },
}));
vi.mock('../../src/services/post.service', () => ({
  postService: { searchPosts: mocks.postSearch },
}));

import { maintenanceTaskController } from '../../src/controllers/maintenanceTask.controller';
import { staffProfileController } from '../../src/controllers/staffProfile.controller';
import { matchingController } from '../../src/controllers/matching.controller';
import { postController } from '../../src/controllers/post.controller';

const request = (body: Record<string, unknown>, query: Record<string, unknown> = {}) =>
  ({ user: { id: 'user-1', role: 'STAFF' }, body, query }) as unknown as AuthRequest;

const response = () => ({ json: vi.fn().mockReturnThis() }) as unknown as Response;

describe('maintenanceTaskController — geo chỉ nhận từ POST body', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.taskBrowseOpen.mockResolvedValue({ items: [], meta: { page: 1, limit: 20, total: 0 } });
  });

  it('GET bỏ qua (không forward) toạ độ dù query có chứa', async () => {
    await maintenanceTaskController.browseOpen(
      request({}, { category: 'PLUMBING', page: '2', latitude: '10.1', longitude: '106.2', radiusKm: '5' }),
      response(),
      vi.fn(),
    );

    expect(mocks.taskBrowseOpen).toHaveBeenCalledTimes(1);
    const filters = mocks.taskBrowseOpen.mock.calls[0][1];
    expect(filters).toMatchObject({ category: 'PLUMBING', page: 2 });
    expect(filters).not.toHaveProperty('latitude');
    expect(filters).not.toHaveProperty('longitude');
    expect(filters).not.toHaveProperty('radiusKm');
  });

  it('POST dùng body, kể cả khi query có giá trị khác', async () => {
    await maintenanceTaskController.browseOpenByLocation(
      request(
        { latitude: 21.0278, longitude: 105.8342, radiusKm: 5, sort: 'nearest' },
        { latitude: '10.1', longitude: '106.2', radiusKm: '1' },
      ),
      response(),
      vi.fn(),
    );

    expect(mocks.taskBrowseOpen.mock.calls[0][1]).toMatchObject({
      latitude: 21.0278,
      longitude: 105.8342,
      radiusKm: 5,
      sort: 'nearest',
    });
  });
});

describe('staffProfileController — geo chỉ nhận từ POST body', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.staffBrowse.mockResolvedValue({ items: [], meta: { page: 1, limit: 20, total: 0 } });
  });

  it('GET không forward toạ độ/bán kính từ query', async () => {
    await staffProfileController.browse(
      request({}, { search: 'thợ điện', latitude: '10.1', longitude: '106.2', radiusKm: '5' }),
      response(),
      vi.fn(),
    );

    const filters = mocks.staffBrowse.mock.calls[0][0];
    expect(filters).toMatchObject({ search: 'thợ điện', page: 1, limit: 20 });
    expect(filters).not.toHaveProperty('latitude');
    expect(filters).not.toHaveProperty('longitude');
    expect(filters).not.toHaveProperty('radiusKm');
  });

  it('POST dùng body và chuẩn hoá số bằng toOptionalNumber', async () => {
    await staffProfileController.browseByLocation(
      request(
        { latitude: '21.0278', longitude: '105.8342', radiusKm: '', sort: 'nearest' },
        { latitude: '10.1', longitude: '106.2' },
      ),
      response(),
      vi.fn(),
    );

    expect(mocks.staffBrowse.mock.calls[0][0]).toMatchObject({
      latitude: 21.0278,
      longitude: 105.8342,
      radiusKm: undefined,
      sort: 'nearest',
    });
  });
});

describe('matchingController — gender chỉ nhận từ POST body', () => {
  const statusResponse = () =>
    ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }) as unknown as Response;

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.matchingPosts.mockResolvedValue([]);
  });

  it('GET không forward gender từ query', async () => {
    await matchingController.getRoommatePosts(
      request({}, { keyword: 'quận 1', gender: 'MALE' }),
      statusResponse(),
      vi.fn(),
    );

    expect(mocks.matchingPosts).toHaveBeenCalledTimes(1);
    const [filters, viewerId] = mocks.matchingPosts.mock.calls[0];
    expect(filters).toMatchObject({ keyword: 'quận 1', limit: 60 });
    expect(filters).not.toHaveProperty('gender');
    expect(viewerId).toBe('user-1');
  });

  it('POST dùng gender từ body, kể cả khi query có giá trị khác', async () => {
    await matchingController.browseRoommatePosts(
      request({ keyword: 'quận 1', gender: 'FEMALE' }, { gender: 'MALE' }),
      statusResponse(),
      vi.fn(),
    );

    expect(mocks.matchingPosts).toHaveBeenCalledTimes(1);
    const [filters] = mocks.matchingPosts.mock.calls[0];
    expect(filters).toMatchObject({ keyword: 'quận 1', gender: 'FEMALE', limit: 60 });
  });
});

describe('postController — toạ độ chỉ nhận từ POST body', () => {
  const statusResponse = () =>
    ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }) as unknown as Response;

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.postSearch.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0 } });
  });

  it('GET không forward lat/lng/radius từ query', async () => {
    await postController.search(
      request(
        {},
        { keyword: 'quận 1', amenityIds: 'a,b', lat: '10.1', lng: '106.2', radius: '5' },
      ),
      statusResponse(),
      vi.fn(),
    );

    expect(mocks.postSearch).toHaveBeenCalledTimes(1);
    const filters = mocks.postSearch.mock.calls[0][0];
    expect(filters).toMatchObject({ keyword: 'quận 1', amenityIds: ['a', 'b'], page: 1, limit: 10 });
    expect(filters).not.toHaveProperty('lat');
    expect(filters).not.toHaveProperty('lng');
    expect(filters).not.toHaveProperty('radius');
  });

  it('POST dùng toạ độ từ body, kể cả khi query có giá trị khác', async () => {
    await postController.searchByLocation(
      request(
        { keyword: 'quận 1', lat: 21.0278, lng: 105.8342, radius: 5 },
        { lat: '10.1', lng: '106.2' },
      ),
      statusResponse(),
      vi.fn(),
    );

    expect(mocks.postSearch).toHaveBeenCalledTimes(1);
    expect(mocks.postSearch.mock.calls[0][0]).toMatchObject({
      keyword: 'quận 1',
      lat: 21.0278,
      lng: 105.8342,
      radius: 5,
    });
  });
});
