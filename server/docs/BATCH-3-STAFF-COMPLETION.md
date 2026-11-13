# BATCH 3 — STAFF WORK EXECUTION & COMPLETION LIFECYCLE

> **Lưu ý đường dẫn test (cập nhật Batch 4):** test đã chuyển từ `server/src/**` sang `server/tests/**`
> (giữ nguyên tên file). Các lệnh `npx vitest run src/...` dưới đây là bản ghi lịch sử.

**Phạm vi:** vòng đời công việc bảo trì SAU khi chủ trọ đã giao việc (Batch 2):
thợ bắt đầu → thợ gửi nghiệm thu → chủ trọ xác nhận/yêu cầu làm lại.
Không thay đổi Batch 1/2/2.1/2.2: Variant B (MaintenanceRequest ↔ MaintenanceTask
tách rời), `sourceIssueId` bắt buộc, H-05 auth/`authVersion`/refresh rotation,
pipeline KYC (`loadKycState`/`assertKycApproved`) và partial unique index
`maintenance_tasks_one_active_per_issue` đều được giữ nguyên.

---

## 1. Trạng thái & bảng chuyển trạng thái

`MaintenanceTaskStatus` (Batch 2.2) chỉ có `OPEN | ASSIGNED | CANCELLED` — không
biểu diễn được "thợ đang làm", "đã gửi nghiệm thu", "đã hoàn thành". Batch 3 bổ
sung **3 giá trị**: `IN_PROGRESS`, `SUBMITTED`, `COMPLETED` (xem §7).

| Từ            | Hành động                       | Sang          | Ai được phép            |
|---------------|---------------------------------|---------------|-------------------------|
| `OPEN`        | `POST /:id/applications` (B2)   | —             | thợ KYC duyệt           |
| `OPEN`        | `POST /:id/applications/:aid/accept` (B2) | `ASSIGNED` | chủ trọ sở hữu   |
| `OPEN`        | `POST /:id/cancel` (B2)         | `CANCELLED`   | chủ trọ sở hữu          |
| `ASSIGNED`    | `POST /:id/start`               | `IN_PROGRESS` | đúng thợ được giao      |
| `IN_PROGRESS` | `POST /:id/completion`          | `SUBMITTED`   | đúng thợ được giao      |
| `SUBMITTED`   | `POST /:id/completion/confirm`  | `COMPLETED`   | chủ trọ sở hữu          |
| `SUBMITTED`   | `POST /:id/completion/reject`   | `IN_PROGRESS` | chủ trọ sở hữu          |

Mọi cặp khác bị từ chối **409** (mã máy đọc được):

- `CANCELLED` / `COMPLETED` → mọi thao tác: `TASK_CANCELLED`, `TASK_COMPLETED`
  (công việc đã kết thúc **không thể bị mở lại** bởi một request cũ).
- `ASSIGNED` → submit: `TASK_NOT_STARTED`; `IN_PROGRESS` → start: `TASK_ALREADY_STARTED`.
- `SUBMITTED` → start: `TASK_AWAITING_REVIEW`; → submit: `COMPLETION_ALREADY_SUBMITTED`.
- `ASSIGNED`/`IN_PROGRESS` → review: `COMPLETION_NOT_SUBMITTED`.
- Thua cuộc đua compare-and-set: `TASK_STATE_CONFLICT` (start),
  `COMPLETION_STATE_CONFLICT` (submit), `COMPLETION_REVIEW_CONFLICT` (review).
- Không phải người được giao/không phải chủ sở hữu: **404**
  (`TASK_NOT_ASSIGNED_TO_YOU`, `TASK_NOT_FOUND`) — không xác nhận sự tồn tại của
  bản ghi cho người lạ.

Sự cố nguồn (`MaintenanceRequest`) được cập nhật **trong cùng transaction**:

- thợ bắt đầu: `PENDING → IN_PROGRESS` (chỉ khi đang `PENDING`);
- chủ trọ xác nhận: `→ COMPLETED` + `resolvedAt = now` (bỏ qua nếu đã `COMPLETED`);
- chủ trọ yêu cầu làm lại: **không** đụng sự cố;
- `triageStatus`/`triageNote`/nội dung báo cáo của khách thuê **không bị ghi đè**.

> Vì sao xác nhận hoàn thành được phép chuyển cả sự cố đang `CANCELLED` sang
> `COMPLETED`: người bấm xác nhận chính là chủ trọ đã quyết định trước đó, và để
> công việc `COMPLETED` gắn với báo cáo `CANCELLED` là trạng thái tự mâu thuẫn
> (khách thuê sẽ thấy sai). Đây là bất biến "task và issue không ở hai trạng thái
> kết thúc xung khắc".

---

## 2. API mới (`/api/v1/maintenance-tasks`)

| Method | Path | Role | Body | Ghi chú |
|--------|------|------|------|---------|
| GET | `/assigned` | STAFF | — (`?status=`) | việc **đã giao cho chính mình**; id lấy từ token |
| POST | `/:id/start` | STAFF | — | KYC + tài khoản kiểm tra trong transaction |
| POST | `/:id/completion` | STAFF | multipart: `note?`, `images[]` (≤5) | cần **ghi chú hoặc ≥1 ảnh** |
| POST | `/:id/completion/confirm` | LANDLORD | `{ note? }` | chuyển `COMPLETED` + đóng sự cố |
| POST | `/:id/completion/reject` | LANDLORD | `{ reason }` (≥10 ký tự) | quay lại `IN_PROGRESS`, lưu lý do |

`GET /:id` (Batch 2) nay trả thêm `isAssignee`, `canStartWork`,
`canSubmitCompletion`, `canReviewCompletion`, `startedAt`, `completionSubmittedAt`,
`completionNote`, `completionReviewedAt`, `completionReviewNote`,
`completionAttempts`, và **tách ảnh**: `images` (hiện trạng) vs
`completionImages` (bằng chứng nghiệm thu).

Các cờ `can*` chỉ là **gợi ý UI** — mọi thao tác vẫn được kiểm tra lại ở server.

### UI

- `client/app/staff/tasks/page.tsx`: mục **"Việc của tôi"** — Bắt đầu, Gửi nghiệm
  thu (ghi chú + ảnh), xem lý do bị yêu cầu làm lại, xem ghi chú của chủ trọ.
- `client/app/landlord/maintenance-tasks/page.tsx`: khối **duyệt nghiệm thu** cho
  công việc `SUBMITTED` — xem ghi chú/ảnh, "Xác nhận hoàn thành" hoặc "Yêu cầu
  làm lại" (bắt buộc lý do ≥ 10 ký tự).

---

## 3. KYC & ranh giới transaction

Thứ tự trong MỌI thao tác ghi của thợ (`start`, `submitCompletion`):

1. đọc công việc theo `assignedStaffId` (404 nếu không phải thợ được giao);
2. `updateMany` **có điều kiện** (`id + assignedStaffId + trạng thái nguồn`) →
   giữ khoá hàng `maintenance_tasks`, chốt lại trạng thái nguồn;
3. **sau khi đã giữ khoá**: đọc lại `users.role`, `users.isActive` và
   `kyc_submissions.status` **trong cùng transaction**;
4. cập nhật ảnh (nếu có) / sự cố nguồn;
5. commit.

Nếu KYC không còn `APPROVED` (hoặc tài khoản bị khoá) ở bước 3 → `throw` ⇒
transaction rollback ⇒ thay đổi trạng thái ở bước 2 **bị huỷ**. Nhờ vậy việc kiểm
tra KYC nằm sát thời điểm commit nhất có thể và luôn **cùng transaction** với
thay đổi trạng thái (không có TOCTOU "kiểm tra trước, ghi sau").

Ảnh nghiệm thu được upload **trước** transaction (dịch vụ ngoài, không rollback
được); nếu transaction thất bại, asset vừa upload bị xoá ngay (`deleteImage`,
`type: 'authenticated'`) để không có ảnh mồ côi/rác Cloudinary.

---

## 4. Đồng thời

Mỗi chuyển trạng thái là **một** câu compare-and-set; kiểm tra `count === 1`:

| Tình huống                                | Kết quả |
|-------------------------------------------|---------|
| Hai lần nộp nghiệm thu song song          | 1 thắng (`SUBMITTED`), 1 nhận 409 `COMPLETION_STATE_CONFLICT` |
| Xác nhận vs yêu cầu làm lại song song     | đúng 1 bên thắng, bên kia 409 `COMPLETION_REVIEW_CONFLICT` |
| Request start cũ sau khi chủ trọ đã quyết | 409 (trạng thái nguồn không còn `ASSIGNED`) |
| Hai lần start song song                   | 1 thắng, 1 nhận 409 `TASK_STATE_CONFLICT` |

Không dựa vào việc ẩn/hiện nút ở frontend.

---

## 5. Thông báo & audit

Thông báo chỉ phát **sau khi commit** (một transaction rollback không để lại
thông báo "đã hoàn thành"), người nhận suy ra từ quan hệ DB:

| Sự kiện | Người nhận | Tiêu đề |
|---------|-----------|---------|
| Thợ bắt đầu | `task.landlordId` | "Thợ đã bắt đầu công việc" |
| Thợ gửi nghiệm thu | `task.landlordId` | "Thợ đã gửi nghiệm thu" |
| Xác nhận hoàn thành | `task.assignedStaffId` | "Công việc đã được xác nhận hoàn thành" |
| Yêu cầu làm lại | `task.assignedStaffId` | "Chủ trọ yêu cầu làm lại" + lý do |

Retry không tạo thông báo trùng: lần thử thứ hai không qua được compare-and-set
nên không commit ⇒ không có thông báo.

Audit (`audit_logs`, `auditService.record`) — không chứa token/URL/secret:

| action | metadata |
|--------|----------|
| `MAINTENANCE_TASK_START` | `from, to` |
| `MAINTENANCE_TASK_SUBMIT_COMPLETION` | `from, to, attempt, note, images` |
| `MAINTENANCE_TASK_CONFIRM_COMPLETION` | `from, to, note, staffId` |
| `MAINTENANCE_TASK_REJECT_COMPLETION` | `from, to, reason, staffId` |


---

## 6. Bằng chứng nghiệm thu (ảnh)

- Tái sử dụng **đúng** pipeline Batch 2.1: `storageService.uploadPrivateImage`
  (Cloudinary `type: authenticated`) → DB chỉ lưu `public_id`; payload chỉ trả
  `/api/v1/maintenance-images/task/<imageId>?token=...` (HMAC, 10 phút).
- Phân loại bằng cột mới `maintenance_task_images.kind` (`TASK` | `COMPLETION`),
  mặc định `TASK` cho dữ liệu cũ. Nhờ vậy:
  - sửa ảnh hiện trạng **không** xoá bằng chứng nghiệm thu
    (`deleteMany: { kind: 'TASK' }`; asset `COMPLETION` bị bỏ qua khi dọn);
  - yêu cầu làm lại + nộp lại **không** ghi đè ảnh trước đó;
  - UI hiển thị hai nhóm riêng (`images` / `completionImages`).
- Quyền xem vẫn do `canViewTaskEvidence` quyết định (chủ trọ sở hữu, thợ được
  giao, thợ từng ứng tuyển, admin; thợ + việc `OPEN` phải KYC APPROVED) và được
  **đọc lại ở mỗi lượt tải ảnh** — token không phải quyền truy cập.
  > Ghi chú: thợ **đã từng ứng tuyển** (kể cả đơn bị từ chối) vẫn xem được ảnh
  > của công việc — giữ nguyên chính sách Batch 2.1 cho ảnh hiện trạng; ảnh
  > nghiệm thu dùng chung quy tắc đó, không mở rộng thêm cho người ngoài.
- Không nhận URL ảnh từ client; `validateUploadedImages` kiểm tra chữ ký tệp;
  giới hạn 5 ảnh/lần, 5MB/tệp.

---

## 7. Schema delta — ĐÃ VIẾT, **CHƯA ÁP DỤNG** LÊN DEV

> Theo yêu cầu của batch: thay đổi DB phải được duyệt trước. Code + test đã sẵn
> sàng, nhưng **chưa** chạy `prisma db push`/SQL trên Supabase DEV.

### 7.1 Prisma (`prisma/schema.prisma`)

```prisma
enum MaintenanceTaskStatus {
  OPEN
  ASSIGNED
  IN_PROGRESS   // 🆕 Batch 3
  SUBMITTED     // 🆕 Batch 3
  COMPLETED     // 🆕 Batch 3
  CANCELLED
}

enum MaintenanceTaskImageKind {
  TASK
  COMPLETION
}

model MaintenanceTask {
  // ...
  startedAt             DateTime? @map("started_at")
  completionSubmittedAt DateTime? @map("completion_submitted_at")
  completionNote        String?   @map("completion_note")
  completionReviewedAt  DateTime? @map("completion_reviewed_at")
  completionReviewNote  String?   @map("completion_review_note")
  completionAttempts    Int       @default(0) @map("completion_attempts")

  @@index([assignedStaffId, status])
}

model MaintenanceTaskImage {
  kind MaintenanceTaskImageKind @default(TASK)
  @@index([taskId, kind])
}
```

### 7.2 SQL (`prisma/sql/batch-3-staff-completion-lifecycle.sql`)

```sql
ALTER TYPE "MaintenanceTaskStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "MaintenanceTaskStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "MaintenanceTaskStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

DO $$ BEGIN
  CREATE TYPE "MaintenanceTaskImageKind" AS ENUM ('TASK', 'COMPLETION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "maintenance_tasks"
  ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completion_submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completion_note" TEXT,
  ADD COLUMN IF NOT EXISTS "completion_reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completion_review_note" TEXT,
  ADD COLUMN IF NOT EXISTS "completion_attempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "maintenance_task_images"
  ADD COLUMN IF NOT EXISTS "kind" "MaintenanceTaskImageKind" NOT NULL DEFAULT 'TASK';

CREATE INDEX IF NOT EXISTS "maintenance_tasks_assigned_staff_id_status_idx"
  ON "maintenance_tasks" ("assigned_staff_id", "status");
CREATE INDEX IF NOT EXISTS "maintenance_task_images_task_id_kind_idx"
  ON "maintenance_task_images" ("task_id", "kind");

-- ⚠️ Index Batch 2.2 phải phủ MỌI trạng thái "đang hoạt động", nếu không thì
-- ngay sau khi thợ bấm "Bắt đầu" (ASSIGNED → IN_PROGRESS) công việc rơi ra khỏi
-- predicate và chủ trọ lại tạo được công việc thứ hai cho cùng một sự cố.
DROP INDEX IF EXISTS "maintenance_tasks_one_active_per_issue";
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_tasks_one_active_per_issue"
  ON "maintenance_tasks" ("source_issue_id")
  WHERE "status" IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED');
```


### 7.3 Preflight (đã chạy, **chỉ đọc**, trên Supabase DEV)

`npm run db:batch3:lifecycle` → exit 0:

- target: `db=postgres host=aws-0-ap-northeast-1.pooler.supabase.com` (DEV);
- `MaintenanceTaskStatus` hiện tại: `OPEN, ASSIGNED, CANCELLED`;
- `MaintenanceTaskImageKind`: chưa có; các cột mới: chưa có;
- index hiện có: `maintenance_tasks_one_active_per_issue` (đúng predicate
  `OPEN, ASSIGNED` của Batch 2.2);
- sự cố có >1 công việc đang hoạt động: **0**;
- số bản ghi: `maintenance_tasks` 0, `maintenance_task_images` 0,
  `maintenance_task_applications` 0, `maintenance_requests` 0
  ⇒ **data impact = 0**: không cần backfill, các cột mới đều có default.

Áp dụng (sau khi được duyệt):

```bash
cd server
npm run db:batch3:lifecycle                        # preflight (chỉ đọc)
node scripts/apply-batch3-lifecycle.js --confirm   # áp dụng + xác minh
```

Sau khi áp dụng, script tự xác minh lại từ `pg_catalog`/`information_schema`
(enum đủ 6 giá trị, đủ 6 cột, `kind` NOT NULL default `TASK`, index unique +
predicate phủ 4 trạng thái, số bản ghi không đổi). Từ chối chạy khi
`NODE_ENV=production`.

---

## 8. Kiểm thử

| Lệnh | Kết quả |
|------|---------|
| `npx tsc --noEmit` (server) | exit 0 |
| `npx tsc --noEmit` (client) | exit 0 |
| `npx eslint` (2 page + api/labels/types) | exit 0 |
| `npx vitest run` (toàn bộ server) | **22 files / 239 tests passed** |
| 7 suite maintenance tập trung | **125 tests passed** |
| `npm run db:batch3:lifecycle` (preflight) | exit 0, không ghi DB |

`src/services/maintenanceWorkflow.service.test.ts` (32 test) phủ: thợ không được
giao; KYC `PENDING`/`REJECTED`/`NONE`; tài khoản khoá; sai role; KYC bị thu hồi
trước khi nộp (xoá ảnh vừa upload); start hợp lệ; nộp hợp lệ; nộp trùng; nộp
song song; chủ trọ khác; xác nhận; yêu cầu làm lại; nộp lại sau khi bị từ chối;
xác nhận vs làm lại đồng thời; request cũ trên việc đã huỷ/hoàn thành; thông báo
chỉ sau commit; transaction lỗi ⇒ không thông báo/audit; tách ảnh + đường dẫn có
token; sự cố nguồn nhất quán.

Hai test cũ của `maintenanceTask.fromIssue.test.ts` được cập nhật theo bất biến
mới (truy vấn chống trùng phải phủ `IN_PROGRESS`/`SUBMITTED`) và vẫn giữ nguyên
phần chống hồi quy: `CANCELLED`/`COMPLETED` **không** nằm trong tập chặn.

---

## 9. Hạn chế / việc còn lại

1. **DB DEV chưa được migrate** (chờ duyệt §7). Cho tới lúc đó, các endpoint mới
   sẽ lỗi `22P02 invalid input value for enum` khi ghi trạng thái `IN_PROGRESS`/
   `SUBMITTED`/`COMPLETED`. Code + test đã sẵn sàng.
2. Index `maintenance_tasks_one_active_per_issue` **không** do Prisma quản lý
   (partial index). Sau mọi `prisma db push`/reset phải chạy
   `node scripts/apply-batch3-lifecycle.js --confirm` (idempotent) để bảo đảm
   predicate rộng — hoặc chuyển thành migration được review.
3. Batch 3 **không** thêm luồng huỷ công việc đã giao (`ASSIGNED`/`IN_PROGRESS`
   không huỷ được) — giữ nguyên phạm vi Batch 2 (huỷ chỉ khi `OPEN`).
4. Không có đàm phán giá/thời gian (`NEGOTIATING`/`AGREED`) — ngoài phạm vi.
5. Chưa có E2E/UI test tự động trong repo; UI được kiểm bằng `tsc` + `eslint`.

