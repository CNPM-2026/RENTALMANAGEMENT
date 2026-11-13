import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canViewIssueEvidence,
  canViewTaskEvidence,
  decorateEvidenceImages,
  loadAuthorizedEvidence,
  mintEvidenceUrl,
  verifyEvidenceToken,
} from '../../src/services/maintenanceEvidence.service';

/**
 * 🆕 Batch 2.1 (M2) — BẰNG CHỨNG ẢNH RIÊNG TƯ.
 *
 * Ba nhóm bất biến được khoá lại:
 * 1. Token: đúng chữ ký, đúng (kind, id), còn hạn; sai một trong ba -> `null`.
 * 2. Phân quyền theo QUAN HỆ NGHIỆP VỤ (không dựa vào "URL khó đoán"):
 *    khách thuê của sự cố / chủ trọ của cơ sở / thợ có quan hệ với công việc,
 *    và thợ đã KYC với việc còn OPEN.
 * 3. Payload: chỉ trả đường dẫn có token, không bao giờ trả `public_id`/URL thật.
 */
const mocks = vi.hoisted(() => ({
  issueImageFindUnique: vi.fn(),
  taskImageFindUnique: vi.fn(),
  applicationFindUnique: vi.fn(),
  kycFindUnique: vi.fn(),
  getPrivateImageUrl: vi.fn(),
}));

vi.mock('../../src/config/db', () => ({
  default: {
    maintenanceRequestImage: { findUnique: mocks.issueImageFindUnique },
    maintenanceTaskImage: { findUnique: mocks.taskImageFindUnique },
    maintenanceTaskApplication: { findUnique: mocks.applicationFindUnique },
    kycSubmission: { findUnique: mocks.kycFindUnique },
  },
}));

vi.mock('../../src/config/env', () => ({
  env: { JWT_SECRET: 'test-secret-for-evidence-tokens-32-chars-min' },
}));

vi.mock('../../src/services/storage.service', () => ({
  storageService: {
    getPrivateImageUrl: mocks.getPrivateImageUrl,
    isPrivateRef: (ref: string) => Boolean(ref) && !ref.includes('://'),
  },
}));

const IMAGE_ID = 'img-1';
const PRIVATE_REF = 'rental-management/maintenance-requests/abc123';
const LEGACY_PUBLIC_URL =
  'https://res.cloudinary.com/demo/image/upload/v1/rental-management/maintenance-requests/abc123.jpg';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getPrivateImageUrl.mockReturnValue(
    'https://res.cloudinary.com/demo/image/authenticated/s--sig--/abc123.jpg',
  );
  mocks.kycFindUnique.mockResolvedValue({ status: 'APPROVED' });
  mocks.applicationFindUnique.mockResolvedValue(null);
});

const tokenOf = (url: string) => new URL(url, 'http://localhost').searchParams.get('token') ?? '';

describe('maintenanceEvidenceService — token', () => {
  it('URL có token trỏ tới route cấp ảnh và không chứa asset thật', () => {
    const url = mintEvidenceUrl('issue', IMAGE_ID, { id: 'tenant-1', role: 'TENANT' });

    expect(url.startsWith('/api/v1/maintenance-images/issue/img-1?token=')).toBe(true);
    expect(url).not.toContain(PRIVATE_REF);
    expect(verifyEvidenceToken('issue', IMAGE_ID, tokenOf(url))).toEqual({
      id: 'tenant-1',
      role: 'TENANT',
    });
  });

  it('sai chữ ký bị từ chối', () => {
    const token = tokenOf(mintEvidenceUrl('task', IMAGE_ID, { id: 'staff-1', role: 'STAFF' }));

    expect(verifyEvidenceToken('task', IMAGE_ID, `${token.slice(0, -2)}xx`)).toBeNull();
    expect(verifyEvidenceToken('task', IMAGE_ID, undefined)).toBeNull();
    expect(verifyEvidenceToken('task', IMAGE_ID, '')).toBeNull();
  });

  it('token cấp cho ảnh/loại khác không dùng lại được (chống đổi id)', () => {
    const token = tokenOf(mintEvidenceUrl('issue', IMAGE_ID, { id: 'tenant-1', role: 'TENANT' }));

    expect(verifyEvidenceToken('issue', 'img-2', token)).toBeNull();
    expect(verifyEvidenceToken('task', IMAGE_ID, token)).toBeNull();
  });

  it('token hết hạn bị từ chối (ngắn hạn, không phải quyền vĩnh viễn)', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const token = tokenOf(mintEvidenceUrl('issue', IMAGE_ID, { id: 'tenant-1', role: 'TENANT' }));
      expect(verifyEvidenceToken('issue', IMAGE_ID, token)).not.toBeNull();

      // 11 phút sau: TTL 10 phút đã hết.
      vi.setSystemTime(new Date('2026-01-01T00:11:00Z'));
      expect(verifyEvidenceToken('issue', IMAGE_ID, token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('maintenanceEvidenceService — phân quyền ảnh sự cố', () => {
  const issue = { tenantId: 'tenant-1', landlordId: 'landlord-1' };

  it('khách thuê báo cáo, chủ trọ của cơ sở và admin được xem', () => {
    expect(canViewIssueEvidence({ id: 'tenant-1', role: 'TENANT' }, issue)).toBe(true);
    expect(canViewIssueEvidence({ id: 'landlord-1', role: 'LANDLORD' }, issue)).toBe(true);
    expect(canViewIssueEvidence({ id: 'admin-1', role: 'ADMIN' }, issue)).toBe(true);
  });

  it('khách thuê khác và chủ trọ khác bị từ chối (chống IDOR/cross-property)', () => {
    expect(canViewIssueEvidence({ id: 'tenant-2', role: 'TENANT' }, issue)).toBe(false);
    expect(canViewIssueEvidence({ id: 'landlord-2', role: 'LANDLORD' }, issue)).toBe(false);
    expect(canViewIssueEvidence({ id: 'staff-1', role: 'STAFF' }, issue)).toBe(false);
  });
});

describe('maintenanceEvidenceService — phân quyền ảnh công việc', () => {
  const openTask = { id: 'task-1', landlordId: 'landlord-1', status: 'OPEN', assignedStaffId: null };
  const assignedTask = { ...openTask, status: 'ASSIGNED', assignedStaffId: 'staff-1' };

  it('chủ trọ sở hữu và thợ được giao luôn được xem', async () => {
    await expect(canViewTaskEvidence({ id: 'landlord-1', role: 'LANDLORD' }, assignedTask)).resolves.toBe(true);
    await expect(canViewTaskEvidence({ id: 'staff-1', role: 'STAFF' }, assignedTask)).resolves.toBe(true);
  });

  it('thợ đã từng ứng tuyển được xem (đã có quan hệ nghiệp vụ)', async () => {
    mocks.applicationFindUnique.mockResolvedValue({ id: 'application-1' });

    await expect(canViewTaskEvidence({ id: 'staff-1', role: 'STAFF' }, assignedTask)).resolves.toBe(true);
  });

  it('thợ đã KYC duyệt xem được ảnh của việc còn OPEN (không phá vỡ marketplace)', async () => {
    await expect(canViewTaskEvidence({ id: 'staff-2', role: 'STAFF' }, openTask)).resolves.toBe(true);
  });

  it('thợ chưa KYC duyệt KHÔNG xem được ảnh của việc còn OPEN', async () => {
    mocks.kycFindUnique.mockResolvedValue({ status: 'PENDING' });

    await expect(canViewTaskEvidence({ id: 'staff-2', role: 'STAFF' }, openTask)).resolves.toBe(false);
  });

  it('thợ không có quan hệ với việc đã giao KHÔNG xem được', async () => {
    await expect(canViewTaskEvidence({ id: 'staff-2', role: 'STAFF' }, assignedTask)).resolves.toBe(false);
  });
});

describe('maintenanceEvidenceService — payload', () => {
  it('thay imageUrl thật bằng đường dẫn có token, giữ nguyên id', () => {
    const decorated = decorateEvidenceImages('task', [{ id: 'img-1' }, { id: 'img-2' }], {
      id: 'landlord-1',
      role: 'LANDLORD',
    });

    expect(decorated.map((image) => image.id)).toEqual(['img-1', 'img-2']);
    for (const image of decorated) {
      expect(image.imageUrl).toMatch(/^\/api\/v1\/maintenance-images\/task\/img-\d\?token=/);
    }
  });

  it('không vỡ khi projection không có ảnh', () => {
    expect(decorateEvidenceImages('issue', undefined, { id: 'tenant-1', role: 'TENANT' })).toEqual([]);
  });
});

describe('maintenanceEvidenceService — loadAuthorizedEvidence', () => {
  const issueRow = (ref: string) => ({
    imageUrl: ref,
    request: { tenantId: 'tenant-1', landlordId: 'landlord-1' },
  });

  const stubFetch = () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('trả bytes qua đường dẫn riêng tư có chữ ký ngắn hạn (không lộ URL thật)', async () => {
    mocks.issueImageFindUnique.mockResolvedValue(issueRow(PRIVATE_REF));
    stubFetch();
    try {
      const token = tokenOf(mintEvidenceUrl('issue', IMAGE_ID, { id: 'tenant-1', role: 'TENANT' }));
      const result = await loadAuthorizedEvidence('issue', IMAGE_ID, token);

      expect(result.contentType).toBe('image/jpeg');
      expect(Array.from(result.buffer)).toEqual([1, 2, 3]);
      // Server yêu cầu Cloudinary cấp URL có hạn, KHÔNG trả asset cho client.
      expect(mocks.getPrivateImageUrl).toHaveBeenCalledWith(PRIVATE_REF, expect.any(Number));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('token không hợp lệ -> 403 (không tiết lộ ảnh có tồn tại hay không)', async () => {
    await expect(loadAuthorizedEvidence('issue', IMAGE_ID, 'gia-mao')).rejects.toMatchObject({
      statusCode: 403,
      code: 'EVIDENCE_TOKEN_INVALID',
    });
    expect(mocks.issueImageFindUnique).not.toHaveBeenCalled();
  });

  it('không có quan hệ nghiệp vụ -> 403 dù token hợp lệ', async () => {
    mocks.issueImageFindUnique.mockResolvedValue(issueRow(PRIVATE_REF));
    const token = tokenOf(mintEvidenceUrl('issue', IMAGE_ID, { id: 'tenant-2', role: 'TENANT' }));

    await expect(loadAuthorizedEvidence('issue', IMAGE_ID, token)).rejects.toMatchObject({
      statusCode: 403,
      code: 'EVIDENCE_FORBIDDEN',
    });
  });

  it('ảnh không tồn tại -> 404', async () => {
    mocks.issueImageFindUnique.mockResolvedValue(null);
    const token = tokenOf(mintEvidenceUrl('issue', IMAGE_ID, { id: 'tenant-1', role: 'TENANT' }));

    await expect(loadAuthorizedEvidence('issue', IMAGE_ID, token)).rejects.toMatchObject({
      statusCode: 404,
      code: 'EVIDENCE_NOT_FOUND',
    });
  });

  it('chặn SSRF: imageUrl trỏ host ngoài Cloudinary bị coi là không tồn tại', async () => {
    mocks.issueImageFindUnique.mockResolvedValue(issueRow('https://evil.example.com/a.jpg'));
    const token = tokenOf(mintEvidenceUrl('issue', IMAGE_ID, { id: 'tenant-1', role: 'TENANT' }));

    await expect(loadAuthorizedEvidence('issue', IMAGE_ID, token)).rejects.toMatchObject({
      statusCode: 404,
      code: 'EVIDENCE_NOT_FOUND',
    });
  });

  it('dữ liệu cũ (URL công khai trên Cloudinary) vẫn xem được nhưng đi qua server', async () => {
    mocks.issueImageFindUnique.mockResolvedValue(issueRow(LEGACY_PUBLIC_URL));
    const fetchMock = stubFetch();
    try {
      const token = tokenOf(mintEvidenceUrl('issue', IMAGE_ID, { id: 'tenant-1', role: 'TENANT' }));
      const result = await loadAuthorizedEvidence('issue', IMAGE_ID, token);

      expect(Array.from(result.buffer)).toEqual([1, 2, 3]);
      expect(fetchMock).toHaveBeenCalledWith(LEGACY_PUBLIC_URL, expect.anything());
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
