# Batch 4/5 — Thay đổi DB còn TỒN ĐỌNG (chưa áp dụng)

> Tài liệu này ghi lại **toàn bộ khác biệt giữa `prisma/schema.prisma` và database thật** tại
> thời điểm Batch 3/4/5 hoàn tất phần code + test. **Chưa có thay đổi nào được ghi xuống DB.**

- Nguồn sinh diff: `npx prisma migrate diff --from-url "$DB_URL" --to-schema-datamodel prisma/schema.prisma --script`
  → lưu nguyên văn tại [`prisma/pending-db-changes.sql`](../prisma/pending-db-changes.sql) (168 dòng).
- Môi trường đọc: `DB_URL` trong `server/.env` (Supabase, pooler `aws-0-ap-northeast-1`). Không chứa secret trong tài liệu.
- Prisma CLI 6.19.3: `prisma db push` **không còn** cờ `--dry-run`, nên diff ở trên được sinh bằng `migrate diff` (chỉ đọc).

## 1. Đối tượng còn thiếu trên DB

### 1.1. Enum

| Enum | Thay đổi | Batch |
| --- | --- | --- |
| `MaintenanceTaskStatus` | `+ IN_PROGRESS`, `+ SUBMITTED`, `+ COMPLETED` | 3 |
| `NotificationType` | `+ OFFER`, `+ REVIEW`, `+ DISPUTE` | 3/4/5 |
| `ReviewTargetType` | `+ TASK` | 5 |
| `MaintenanceTaskImageKind` | **mới**: `TASK`, `COMPLETION` | 3 |
| `MaintenanceOfferStatus` | **mới**: `PENDING`, `ACCEPTED`, `REJECTED`, `SUPERSEDED`, `WITHDRAWN` | 4 |
| `MaintenanceOfferActor` | **mới**: `LANDLORD`, `STAFF` | 4 |
| `DisputeCategory` | **mới**: `WORK_QUALITY`, `NO_SHOW`, `PRICE_DISPUTE`, `SAFETY`, `HARASSMENT`, `FRAUD`, `PROPERTY_DAMAGE`, `OTHER` | 4 |

> PostgreSQL < 12 không cho `ALTER TYPE ... ADD VALUE` nhiều giá trị trong cùng transaction;
> `scripts/apply-batch3-lifecycle.js` và `scripts/apply-platform-delta.js` đã tách từng câu lệnh.

### 1.2. Cột mới

| Bảng | Cột | Ghi chú |
| --- | --- | --- |
| `maintenance_tasks` | `agreed_amount`, `agreed_at`, `negotiation_version` (NOT NULL DEFAULT 0) | Thương lượng giá (Batch 4) — `agreed_amount` **chỉ** ghi khi ACCEPT |
| | `started_at`, `completion_submitted_at`, `completion_attempts` (NOT NULL DEFAULT 0), `completion_note`, `completion_reviewed_at`, `completion_review_note` | Vòng đời hoàn thành (Batch 3) |
| `maintenance_task_applications` | `proposed_amount` DECIMAL(12,2) NULL | Giá đề xuất của thợ khi ứng tuyển |
| `maintenance_task_images` | `kind` (NOT NULL DEFAULT 'TASK') | Phân biệt ảnh hiện trạng / ảnh nghiệm thu |
| `messages` | `client_message_id`, `attachment_ref`, `attachment_mime`, `attachment_bytes`, `attachment_name` | Idempotency + tệp đính kèm **private** (Batch 5) |
| `notifications` | `read_at`, `dedupe_key` | Đánh dấu đã đọc + chống trùng |
| `reports` | `category` (NOT NULL DEFAULT 'OTHER'), `task_id`, `resolution`, `resolved_by_id`, `resolved_at`, `updated_at` (NOT NULL DEFAULT now) | Tranh chấp (Batch 4) |
| `conversations` | `task_id` | Neo hội thoại vào công việc |

### 1.3. Bảng mới

- `maintenance_task_offers` — đề xuất giá có **version tăng dần** (CAS), unique `(task_id, version)`.
- `report_attachments` — tệp bằng chứng của tranh chấp, `ON DELETE CASCADE` theo report.

### 1.4. Index / FK mới

Index: `reports_(status, created_at)`, `reports_(reporter_id, created_at)`, `reports_task_id_idx`,
`notifications_(user_id, created_at)`, `notifications_dedupe_key_key` (UNIQUE),
`messages_(conversation_id, client_message_id)` (UNIQUE — chống gửi trùng khi mất mạng),
`maintenance_tasks_(assigned_staff_id, status)`, `maintenance_task_images_(task_id, kind)`,
`maintenance_task_offers_(task_id, status)`, `maintenance_task_offers_(task_id, version)` (UNIQUE),
`report_attachments_report_id_idx`, `conversations_task_id_idx`.
Đồng thời **DROP** `maintenance_task_images_task_id_idx` (thay bằng index ghép `(task_id, kind)`).

FK: `conversations.task_id → maintenance_tasks` (SET NULL), `reports.task_id → maintenance_tasks` (SET NULL),
`reports.resolved_by_id → users` (SET NULL), `report_attachments.report_id → reports` (CASCADE),
`maintenance_task_offers.task_id → maintenance_tasks` (CASCADE),
`maintenance_task_offers.proposed_by_id → users` (CASCADE),
`maintenance_task_offers.responded_by_id → users` (SET NULL).

## 2. Đối tượng Prisma KHÔNG quản lý (phải chạy script riêng)

`prisma db push` không tạo được **partial unique index**, nên bất biến "mỗi sự cố chỉ có 1 công việc đang hoạt động"
phải áp bằng script:

```sql
CREATE UNIQUE INDEX "maintenance_tasks_one_active_per_issue"
  ON "maintenance_tasks" ("source_issue_id")
  WHERE "status" IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED');
```

`scripts/apply-maintenance-task-index.js` và `scripts/apply-batch3-lifecycle.js` đều `CREATE ... IF NOT EXISTS`
và kiểm tra lại `pg_indexes`/`pg_index` sau khi chạy. Nếu predicate bị thu hẹp (thiếu `IN_PROGRESS`/`SUBMITTED`)
thì tình trạng "2 công việc cùng mở trên 1 sự cố" vẫn xảy ra ở các trạng thái mới.


## 3. Thứ tự áp dụng đề xuất (khi được duyệt)

> ⚠️ **Các lệnh dưới đây thiếu `--confirm` (chỉ preflight) và `db:platform:delta` hiện không thể chạy xong.**
> Đọc **§3.1** trước — đó là quy trình đã hiệu chỉnh sau rà soát 2026-11-13.

```powershell
cd server

# 1) Enum + bảng + cột cho offer/dispute/chat (idempotent nhờ DO $$ ... duplicate_object)
npm run db:platform:delta

# 2) Vòng đời công việc Batch 3 + tạo lại partial unique index với predicate rộng
npm run db:batch3:lifecycle

# 3) Xác nhận "một công việc đang hoạt động / sự cố" (script tự kiểm tra pg_index)
npm run db:index:one-active-task

# 4) Đồng bộ Prisma Client (chỉ khi máy chưa generate lại)
npx prisma generate
```

Lưu ý:

- `prisma/pending-db-changes.sql` là **bản diff tham khảo**, không idempotent (`CREATE TYPE`/`CREATE TABLE` trần),
  **không chạy trực tiếp** sau khi đã chạy các script ở trên — sẽ lỗi `already exists`.
- Script có `--confirm`/`inventory` mới ghi DB: luôn chạy chế độ kiểm kê trước
  (`npm run evidence:inventory`) để biết dữ liệu nào sẽ bị ảnh hưởng.
- Không dùng `prisma db push --force-reset` / `prisma migrate reset` trên môi trường này (mất dữ liệu thật).

## 3.1. Rà soát sẵn sàng triển khai — 2026-11-13 (chỉ đọc)

> Kết luận: **CHƯA AN TOÀN để chạy nguyên §3.** Không có lệnh ghi DB nào được thực thi trong lần rà soát này;
> toàn bộ số liệu dưới đây lấy từ `SELECT`/`pg_catalog` + `prisma migrate diff` (chỉ đọc).

### 3.1.1. Danh tính target (không in credential)

| Hạng mục | Giá trị |
| --- | --- |
| Host / DB | `aws-0-ap-northeast-1.pooler.supabase.com` / `postgres` (port 5432) |
| Project ref (masked) | `hgck****qmvm` — trùng `DB_URL` trong `server/.env` (DEV theo BATCH-2 §7, §11.3) |
| Fingerprint | SHA-256 của `host\|port\|database\|ref`, 16 hex đầu = `d5055c8fce27c04b` |
| DB test (khác project) | `aws-0-eu-west-1…`, ref `tzbv****cmjm` ⇒ hai môi trường tách biệt |
| PostgreSQL | 17.11, `read committed`, `pg_is_in_recovery() = false` |
| `_prisma_migrations` | **không tồn tại** ⇒ schema do `db push` + SQL tay; `migrate deploy/reset` không áp dụng được |

### 3.1.2. Dữ liệu hiện có (kiểm tra xung đột)

| Kiểm tra | Kết quả |
| --- | --- |
| `maintenance_tasks` | **0 dòng** (mọi status) ⇒ không thể xung đột partial unique index |
| `reports` / `messages` / `notifications` | 2 / 13 / 13 dòng |
| `messages.client_message_id`, `notifications.dedupe_key` | cột **chưa tồn tại** ⇒ unique index không thể xung đột ở lần chạy đầu (NULL được phép lặp) |
| `reports.category` NOT NULL DEFAULT | 2 dòng cũ nhận `'OTHER'`, không rewrite bảng (PG 11+) |
| FK mới (`reports.task_id`, `reports.resolved_by_id`, `conversations.task_id`) | cột mới toàn NULL ⇒ không có orphan |
| Kiểu khoá | `users.id`, `maintenance_tasks.id`, `reports.id`, `conversations.id`, `messages.conversation_id` đều `text` |
| `maintenance_task_offers`, `report_attachments` | chưa tồn tại |
| Index cũ `maintenance_task_images_task_id_idx` | **đang tồn tại** (cần DROP, xem 3.1.6) |
| `maintenance_tasks_one_active_per_issue` | unique + valid, predicate chỉ `OPEN, ASSIGNED` |
| Diff hiện tại | **126 dòng**, khớp đúng từng câu với `prisma/pending-db-changes.sql` ⇒ không có drift lạ |

### 3.1.3. Blocker 1 — `db:platform:delta` không thể chạy xong

`prisma.$executeRawUnsafe()` dùng prepared statement; PostgreSQL trả
`42601 cannot insert multiple commands into a prepared statement` (Prisma `P2010`) khi một entry chứa >1 câu.
**7/20 entry** trong `scripts/apply-platform-delta.js` thuộc dạng này: FK offers, index reports, FK reports,
`report_attachments`, `conversations`, `messages`, `notifications`.
⇒ Với `--confirm`, script dừng ở entry FK offers **sau khi** đã tạo enum + bảng offers; các entry
reports/messages/notifications **không bao giờ chạy**. Không mất dữ liệu nhưng schema dở dang và chạy lại vẫn lỗi.
**Phải tách mỗi entry thành đúng MỘT câu SQL trước khi áp** (giữ nguyên preflight/verify).

### 3.1.4. Blocker 2 — lệnh trong §3 thiếu `--confirm`

`db:platform:delta` và `db:batch3:lifecycle` **không** có `--confirm` trong `package.json` ⇒ chỉ in preflight rồi `exit 0`.
Ngược lại `db:index:one-active-task` **có** `--confirm` sẵn ⇒ là lệnh duy nhất thực sự ghi, nhưng khi index đã tồn tại
nó `return 0` mà không kiểm tra predicate ⇒ dễ kết luận sai là đã deploy.

### 3.1.5. Blocker 3 — không dùng `prisma db execute` cho Batch 3

`prisma db execute --file prisma/sql/batch-3-staff-completion-lifecycle.sql` chạy cả file trong MỘT transaction
(đã kiểm chứng: `db execute` nhận multi-statement, khác `$executeRawUnsafe`). Trong cùng transaction đó,
`ALTER TYPE … ADD VALUE` rồi dùng `IN_PROGRESS`/`SUBMITTED` trong predicate index sẽ bị PostgreSQL 12+ chặn
bằng `55P04 unsafe use of new value` (giới hạn được ghi ngay trong header của file SQL). Đây là suy luận từ
ngữ nghĩa PostgreSQL + thiết kế script; **không thể chứng minh bằng thực nghiệm ở đây vì sẽ là lệnh ghi DB**.
Kết luận: Batch 3 bắt buộc chạy từng câu qua script.


### 3.1.6. Việc còn lại sau khi áp: DROP index cũ

Hai script **không** DROP `maintenance_task_images_task_id_idx`, nên `migrate diff` sau khi áp vẫn còn đúng một câu
`DROP INDEX`. Index ghép `(task_id, kind)` có `task_id` là cột đầu ⇒ thay thế hợp lệ cho index cũ (mọi truy vấn
`WHERE task_id = …` vẫn dùng được). Chạy sau khi áp (bảng hiện 0 dòng):

```sql
DROP INDEX IF EXISTS "maintenance_task_images_task_id_idx";
```

### 3.1.7. Lệnh chuẩn (chỉ dùng SAU khi sửa Blocker 1 và được duyệt)

```powershell
cd server

# 1) Preflight (chỉ đọc) — phải in "Còn thiếu: …" và KHÔNG ghi gì
node scripts/apply-platform-delta.js

# 2) Áp enum + cột + bảng offer/dispute/chat (idempotent; từng câu một)
node scripts/apply-platform-delta.js --confirm

# 3) Preflight Batch 3 (chỉ đọc) — phải báo "không có sự cố nào có >1 công việc OPEN/ASSIGNED"
node scripts/apply-batch3-lifecycle.js

# 4) Áp Batch 3 + tạo lại partial unique index với predicate rộng
node scripts/apply-batch3-lifecycle.js --confirm

# 5) Chỉ xác nhận index (khi index đã tồn tại script là no-op, KHÔNG kiểm tra predicate)
node scripts/apply-maintenance-task-index.js

# 6) Dọn index cũ còn sót để diff về 0 (một câu, chạy sau bước 4)
'DROP INDEX IF EXISTS "maintenance_task_images_task_id_idx";' |
  npx prisma db execute --stdin --schema prisma/schema.prisma
#    (hoặc chạy câu SQL ở 3.1.6 bằng SQL editor của Supabase)

# 7) Client + kiểm tra tĩnh
npx prisma generate
npm run typecheck
npm test
```

Không chạy `npm run db:index:one-active-task` **trước** bước 4: nếu index vắng mặt, script tạo predicate hẹp
(`OPEN, ASSIGNED`) và trạng thái đó sẽ không được script Batch 3 coi là "đã xong".

### 3.1.8. Xác minh sau khi áp (chỉ đọc)

1. `npx prisma migrate diff --from-url "$env:DB_URL" --to-schema-datamodel prisma/schema.prisma --script`
   → **rỗng** (sau bước 6). Trước bước 6 chỉ được có duy nhất `DROP INDEX "maintenance_task_images_task_id_idx"`.
2. Chạy các truy vấn ở §4.
3. `pg_indexes` phải có `maintenance_tasks_one_active_per_issue` với predicate chứa đủ 4 trạng thái.
4. Số dòng các bảng nghiệp vụ không đổi (script tự so sánh trước/sau).

### 3.1.9. Giới hạn rollback

- `ALTER TYPE … ADD VALUE` **không thể xoá** giá trị ⇒ enum không rollback được bằng DDL; muốn lùi phải tạo type mới,
  đổi kiểu cột và migrate dữ liệu.
- Cột/bảng/index mới: DROP được (xem comment cuối `prisma/sql/platform-overhaul-delta.sql`) nhưng **mất dữ liệu phát sinh**
  sau deploy (offer, đính kèm, tranh chấp).
- Partial index: khôi phục predicate cũ bằng DROP/CREATE — mất lớp bảo vệ cho `IN_PROGRESS`/`SUBMITTED`.
- Không có backup tự động trong các script: **chụp snapshot/backup Supabase DEV trước khi áp**.
- `prisma/pending-db-changes.sql` không idempotent (không `IF NOT EXISTS`, `DROP INDEX` trần) và không chứa partial index
  ⇒ chỉ dùng để tham chiếu/so diff, **không chạy trực tiếp**.

### 3.1.10. Ghi chú an toàn target

Cả ba script đều đọc `DB_URL` từ `server/.env` và chỉ từ chối khi `NODE_ENV=production` (hiện **chưa đặt**).
Không có kiểm tra allowlist host ⇒ một `DB_URL` trỏ sai vẫn được chấp nhận. Trước khi áp:
`node -e "require('dotenv').config();const u=new URL(process.env.DB_URL);console.log(u.hostname,u.pathname)"`
phải in `aws-0-ap-northeast-1.pooler.supabase.com /postgres`. Khuyến nghị bổ sung allowlist host trong script.


## 4. Truy vấn xác minh sau khi áp (chỉ đọc)

```sql
-- enum đã đủ giá trị
SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname IN ('MaintenanceTaskStatus','NotificationType','ReviewTargetType',
                    'MaintenanceTaskImageKind','MaintenanceOfferStatus',
                    'MaintenanceOfferActor','DisputeCategory')
GROUP BY t.typname;

-- bảng / cột mới
SELECT table_name, column_name FROM information_schema.columns
WHERE table_name IN ('maintenance_task_offers','report_attachments')
   OR (table_name = 'reports' AND column_name IN ('category','resolution','resolved_at','resolved_by_id','task_id'));

-- partial unique index đúng predicate
SELECT indexdef FROM pg_indexes
WHERE tablename = 'maintenance_tasks' AND indexname = 'maintenance_tasks_one_active_per_issue';
```

## 5. Trạng thái kiểm thử tương ứng

| Hạng mục | Trạng thái |
| --- | --- |
| Unit test service (mock `config/db`) — offer/review/report/chat/workflow | ✅ chạy được, không cần DB |
| `npm run typecheck` (`tsc -p tsconfig.test.json`, gồm cả `tests/**`) | ✅ pass (exit 0) |
| Integration test (`tests/integration/**`) | ✅ pass trên **DB test** (Supabase `eu-west-1`, `DB_URL` trong `.env.test`) — đã `prisma db push` + seed |
| `tests/services/auth.session.db.test.ts` | ✅ pass trên DB test |
| `npm test` toàn bộ | ✅ **26 file / 280 test pass** (~131s) |

Phân biệt hai môi trường:

- **DB test** (`.env.test`): đã đồng bộ schema + seed bằng
  `npx prisma db push --accept-data-loss` → `npm run db:test:seed`. Đây là nơi `npm test` chạy.
- **DB dev/prod** (`.env`, `DB_URL` Supabase `ap-northeast-1`): **vẫn còn nguyên diff ở mục 1–2**,
  phải áp theo mục 3 khi được duyệt.

Lưu ý khi chạy lại trên máy khác:

- `prisma db push` sẽ **dừng chờ xác nhận** nếu có cảnh báo mất dữ liệu (unique index trên
  `messages(conversation_id, client_message_id)` và `notifications(dedupe_key)`). Trong CI/script
  không tương tác, phải thêm `--accept-data-loss` (chỉ trên DB test).
- Sau khi áp DDL cho DB dev/prod, chạy `npx prisma generate` rồi `npm run typecheck && npm test`.

## 6. Thay đổi kèm theo trong lần rà soát này

- `server/tsconfig.test.json`: sửa ký tự lạ ở đầu file (`w{` → `{`) — trước đó `tsc -p tsconfig.test.json`
  báo `TS1005` dù script npm che mất mã lỗi. Nay `npm run typecheck` exit 0.
- `.github/workflows/backend-ci.yml`: thêm bước `npm run typecheck` sau `npm run build` để test trong
  `tests/**` cũng được kiểm tra kiểu trên CI.
- Xoá bản trùng `server/src/services/maintenanceWorkflow.service.test.ts` (bản chuẩn nằm ở
  `server/tests/services/maintenanceWorkflow.service.test.ts`); dọn luôn `*.test.js` cũ trong `dist/`.
- `client/app/admin/reports/page.tsx`: nút "Xoá bài & kết luận" kiểm tra `resolution` **trước** khi gọi
  API xoá bài, tránh cảnh bài đã xoá nhưng hồ sơ không đóng được vì thiếu kết luận.
- `client/app/(tenant)/tenant/safety/report/page.tsx`: bỏ import icon không dùng (eslint warning).
- `client/lib/api.ts` + `client/types/models.ts`: xoá type chết `CreateReportPayload` (đã được
  `CreateDisputePayload` thay thế — có `category`/`taskId`), hết warning eslint còn lại.
- 6 tài liệu lịch sử (`AUTH-HARDENING-RUNBOOK`, `BATCH-1`, `BATCH-2`, `BATCH-2.1`, `BATCH-2.2`, `BATCH-3`)
  được thêm ghi chú đầu trang: đường dẫn test cũ `src/**` nay là `tests/**`.

