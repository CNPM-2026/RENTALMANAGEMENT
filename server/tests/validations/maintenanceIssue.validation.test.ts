import { describe, expect, it } from 'vitest';
import { maintenanceTriageSchema } from '../../src/validations/resource.validation';
import { maintenanceTaskFromIssueSchema } from '../../src/validations/maintenanceTask.validation';

/**
 * 🆕 Batch 2 (điều chỉnh luồng) — validation của hai bước mới:
 * 1. chủ trọ TIẾP NHẬN báo cáo sự cố (`maintenanceTriageSchema`);
 * 2. chuyển sự cố thành công việc (`maintenanceTaskFromIssueSchema`).
 *
 * Điểm dễ vỡ: "cần bổ sung thông tin"/"từ chối" mà không có lý do là vô nghĩa với
 * khách thuê, và form chuyển đổi KHÔNG được nhận `propertyId`/`address` — nơi
 * làm việc phải suy ra từ sự cố, nếu không chủ trọ có thể đăng việc ở nơi khác.
 */
describe('maintenanceTriageSchema', () => {
  it('chấp nhận REVIEWED không cần lý do', () => {
    expect(maintenanceTriageSchema.parse({ triageStatus: 'REVIEWED' }).triageStatus).toBe('REVIEWED');
  });

  it('bắt buộc có lý do khi NEEDS_INFO/REJECTED', () => {
    expect(maintenanceTriageSchema.safeParse({ triageStatus: 'NEEDS_INFO' }).success).toBe(false);
    expect(maintenanceTriageSchema.safeParse({ triageStatus: 'REJECTED' }).success).toBe(false);
    expect(
      maintenanceTriageSchema.safeParse({ triageStatus: 'NEEDS_INFO', triageNote: 'Thiếu ảnh hiện trạng' })
        .success,
    ).toBe(true);
  });

  it('chuỗi rỗng được coi là không có lý do, và trạng thái ngoài enum bị chặn', () => {
    expect(
      maintenanceTriageSchema.safeParse({ triageStatus: 'REJECTED', triageNote: '   ' }).success,
    ).toBe(false);
    expect(maintenanceTriageSchema.safeParse({ triageStatus: 'DONE' }).success).toBe(false);
  });
});

describe('maintenanceTaskFromIssueSchema', () => {
  it('chấp nhận payload rỗng (server lấy toàn bộ từ sự cố)', () => {
    expect(maintenanceTaskFromIssueSchema.parse({})).toEqual({});
  });

  it('loại bỏ propertyId/roomId/address do client gửi (nơi làm việc lấy từ sự cố)', () => {
    const parsed = maintenanceTaskFromIssueSchema.parse({
      propertyId: '11111111-1111-4111-8111-111111111111',
      roomId: '33333333-3333-4333-8333-333333333333',
      address: 'Địa chỉ tự nhập',
      title: 'Thay vòi nước bếp',
    });
    expect(parsed).not.toHaveProperty('propertyId');
    expect(parsed).not.toHaveProperty('roomId');
    expect(parsed).not.toHaveProperty('address');
    expect(parsed.title).toBe('Thay vòi nước bếp');
  });

  it('vẫn áp dụng ràng buộc chéo trường như form công việc', () => {
    expect(
      maintenanceTaskFromIssueSchema.safeParse({ budgetMin: 900_000, budgetMax: 100_000 }).success,
    ).toBe(false);
    expect(
      maintenanceTaskFromIssueSchema.safeParse({
        preferredStartAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        preferredEndAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }).success,
    ).toBe(false);
    expect(maintenanceTaskFromIssueSchema.safeParse({ urgency: 'URGENT' }).success).toBe(false);
  });
});
