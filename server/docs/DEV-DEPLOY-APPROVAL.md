# DEV DEPLOY APPROVAL — Occupancy & Invoice snapshot + sửa script deploy

> **Trạng thái: ĐÃ ÁP DỤNG LÊN SUPABASE DEV (2026-11-13).** Cả 4 đợt DDL đã chạy
> với `--confirm`, `prisma migrate diff` trả **0 khác biệt**, và khai báo occupancy
> cho dữ liệu hiện hữu đã được seed theo phương án **B** (§4). Báo cáo nghiệm thu
> đầy đủ ở §11; nội dung §1–§10 giữ nguyên làm hồ sơ duyệt.

- Target đã xác nhận bởi preflight: `host=aws-0-ap-northeast-1.pooler.supabase.com`,
  `db=postgres` (Supabase DEV). Guard sẽ từ chối mọi host khác và `NODE_ENV=production`.
- Ngày lập: 2026-11-13.

---

## 1. Phạm vi thay đổi DB (additive, không sửa/xoá dữ liệu nghiệp vụ)

| # | Script | Câu SQL | Nội dung |
|---|--------|---------|----------|
| 1 | `db:platform:delta` | 44 | Enum + bảng + cột + index + FK của Batch 1–5 (offer, review TASK, dispute, evidence, dedupe notification…) |
| 2 | `db:batch3:lifecycle` | 11 | `MaintenanceTaskStatus += IN_PROGRESS/SUBMITTED/COMPLETED`, `MaintenanceTaskImageKind`, cột tiến độ/nghiệm thu, index tra cứu, **composite `(task_id, kind)` + DROP legacy `maintenance_task_images_task_id_idx`** |
| 3 | `db:index:one-active-task` | 1 (DROP + CREATE) | Partial unique index `maintenance_tasks_one_active_per_issue` mở rộng predicate sang **OPEN, ASSIGNED, IN_PROGRESS, SUBMITTED** |
| 4 | `db:occupancy:delta` | 23 | `NotificationType += OCCUPANCY`, enum `OccupancyDeclarationStatus`, bảng `room_occupancy_declarations`, 3 index (gồm partial unique `(room_id, tenant_id)` cho PENDING/VERIFIED chưa bị thay thế), 5 FK, **8 cột snapshot trên `invoices`** + 1 index + 1 FK. 2 câu `DO $$` chỉ để **đổi tên** index cũ về tên mặc định của Prisma (DB đã áp bản trước) |

Tổng: **79 câu**, chạy theo đúng thứ tự 1 → 4. Mỗi câu là một transaction riêng
(bắt buộc với `ALTER TYPE … ADD VALUE`), idempotent nên chạy lại sau gián đoạn là an toàn.

### 1.1. Trạng thái DEV sau khi áp (preflight đọc lại, 2026-11-13)

- `platform`: ✅ "Schema đã đúng đặc tả — không cần chạy lại." (44/44).
- `batch3`: ✅ đúng đặc tả; predicate index phủ đủ
  `OPEN, ASSIGNED, IN_PROGRESS, SUBMITTED`; dữ liệu
  `maintenance_tasks=0`, `maintenance_task_images=0`, `maintenance_request=1`
  không đổi.
- `one-active-task`: ✅ `unique=true valid=true ready=true`, predicate 4 trạng thái.
- `occupancy`: ✅ đủ **20 cột, 4 index, 6 FK**; `room_occupancy_declarations`
  có `rooms=5, contracts=3, invoices=0` (không đổi).
- `prisma migrate diff --from-schema-datasource prisma/schema.prisma
  --to-schema-datamodel prisma/schema.prisma --exit-code` → **"No difference detected." (exit 0)**.

Trạng thái **trước** khi áp (giữ để đối chiếu): platform thiếu nhiều object
(OFFER/REVIEW/DISPUTE, bảng offer, `reports.task_id`, FK…); batch3 thiếu enum
`IN_PROGRESS/SUBMITTED/COMPLETED` + cột + composite index; index
`one_active_per_issue` tồn tại nhưng predicate **hẹp** (`OPEN, ASSIGNED`);
occupancy thiếu toàn bộ 21 câu.

---

## 2. Thứ tự lệnh DEV (sau khi được duyệt)

```powershell
cd d:\RENTALMANAGEMENT\server

# 0) Xác nhận target + xem danh sách câu sẽ chạy (KHÔNG ghi)
npm run db:platform:delta:preflight
npm run db:batch3:lifecycle:preflight
npm run db:index:one-active-task:preflight
npm run db:occupancy:delta:preflight

# 1) Áp dụng (mỗi lệnh phải kết thúc ✅ và exit 0)
npm run db:platform:delta
npm run db:batch3:lifecycle
npm run db:index:one-active-task
npm run db:occupancy:delta

# 2) Đồng bộ Prisma client theo schema đã áp
npx prisma validate
npx prisma generate
```

> **Đã thực thi đúng thứ tự này.** Lưu ý Windows: `npx prisma generate` trả
> `EPERM … query_engine-windows.dll.node` nếu `ts-node-dev` đang giữ file —
> dừng server, generate, rồi `npm run dev` lại (client Prisma mới chỉ có hiệu lực
> sau khi restart tiến trình Node).

**Mã thoát cần hiểu đúng**

| Script | 0 | 2 | 1 |
|--------|---|---|---|
| `apply-platform-delta` | đã đúng / áp xong | — | lỗi SQL hoặc verify thiếu object |
| `apply-batch3-lifecycle` | đã đúng / áp xong | — | lỗi SQL, verify thiếu object, hoặc số bản ghi thay đổi |
| `apply-maintenance-task-index` | đã đúng predicate | index tồn tại nhưng SAI predicate và **chưa** `--confirm` (không phải thành công) | lỗi SQL/verify |
| `apply-occupancy-invoice-delta` | đã đúng / áp xong | — | lỗi SQL, verify thiếu object, hoặc số bản ghi thay đổi |

> Trên Windows, `npm run` có thể trả 1 thay vì 2. Muốn thấy đúng mã 2:
> `node scripts/apply-maintenance-task-index.js` (đã kiểm chứng: `exit=2`).

---

## 3. Bất biến an toàn đã cài trong script

1. `scripts/lib/target-guard.js`: allowlist host DEV
   (`aws-0-ap-northeast-1.pooler.supabase.com`, mở rộng có kiểm soát qua
   `DB_HOST_ALLOWLIST`), từ chối `NODE_ENV=production`. Đã kiểm chứng: host lạ
   `evil.example.com` ⇒ dừng ngay, exit 1.
2. `assertSingleStatement` cho **từng entry**: một entry chứa ≥2 câu ⇒ dừng
   trước khi ghi (tránh Prisma nuốt câu thứ hai).
3. Cổng `--confirm`: mọi vòng ghi nằm SAU cổng; preflight in
   “CHƯA ÁP DỤNG … KHÔNG phải deploy thành công”.
4. `requireEnv(['DB_URL'])` nằm trong `main` ⇒ preflight cũng dừng nếu thiếu env.
5. Verify sau khi áp: thiếu bất kỳ cột/index/FK ⇒ exit 1 (không “thành công nửa vời”).
6. Occupancy delta chụp `COUNT(*)` các bảng nghiệp vụ trước/sau: lệch ⇒ exit 1.
7. Toàn bộ additive: không UPDATE/DELETE/backfill, không đổi kiểu cột cũ.

---

## 4. ✅ Quyết định đã chốt: phương án B (seed khai báo DEV)

`generateInvoice` **chặn** khi chưa có khai báo số người ở đã xác minh
(`OCCUPANCY_NOT_VERIFIED`). Đây là hành vi có chủ đích (tiền nước tính theo
đầu người). Chủ dự án đã chọn **B**, nên đã bổ sung script riêng:

```powershell
npm run db:occupancy:seed:dev:preflight   # chỉ đọc: in danh sách hợp đồng sẽ seed
npm run db:occupancy:seed:dev             # --confirm: ghi
```

- `scripts/seed-dev-occupancy.js`: INSERT `VERIFIED` cho mọi hợp đồng `ACTIVE`
  **chưa** có khai báo `PENDING/VERIFIED` (chưa bị superseded).
- `occupants = 1` (giá trị bảo thủ; giới hạn bởi `rooms.max_occupants`) — tenant
  vẫn khai lại số người thật rồi chủ trọ xác minh lại được.
- `declared_by_id = tenant`, `verified_by_id = landlord` của property.
- Guard target DEV + `--confirm`; **idempotent** (chạy lại không tạo thêm);
  không UPDATE/DELETE bảng nào khác.
- Kết quả DEV: tạo **3** khai báo `VERIFIED` (phòng `P.101`, `1`, `T-102`);
  chạy lại preflight → "Không có hợp đồng nào cần seed".

Hoá đơn cũ có 8 cột snapshot `NULL` — UI hiển thị “Không có dữ liệu (hoá đơn cũ)”,
**không** suy ra từ giá hiện tại.

---

## 5. Xác minh sau khi áp (không thay đổi dữ liệu)

```powershell
cd d:\RENTALMANAGEMENT\server

# 5.1. Schema đồng bộ
npx prisma validate
# Prisma tự đọc DB_URL từ server/.env (tránh $env:DB_URL rỗng trong shell mới):
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
#   (kỳ vọng: không còn khác biệt; nếu có, dừng và báo lại)

# 5.2. Preflight phải báo “đã đúng” cho cả 4 đợt
npm run db:platform:delta:preflight
npm run db:batch3:lifecycle:preflight
npm run db:index:one-active-task:preflight
npm run db:occupancy:delta:preflight
npm run db:occupancy:seed:dev:preflight

# 5.3. Predicate index đúng 4 trạng thái
node -e "require('dotenv').config({path:'.env'});const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.$queryRaw`SELECT indexdef FROM pg_indexes WHERE indexname='maintenance_tasks_one_active_per_issue'`.then(r=>{console.log(r);return p.$disconnect()})"

# 5.4. Không còn index legacy trên ảnh
node -e "require('dotenv').config({path:'.env'});const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.$queryRaw`SELECT indexname FROM pg_indexes WHERE tablename='maintenance_task_images'`.then(r=>{console.log(r);return p.$disconnect()})"
```

Smoke test API sau `prisma generate` + restart server (chạy thật trên DEV):

| Bước | Kết quả |
|---|---|
| `GET /api/v1/notifications` (LANDLORD, TENANT) | **200** (trước khi áp: **500**) |
| `GET /api/v1/notifications/unread-count` | 200 |
| `GET /api/v1/chats/conversations` (LANDLORD, TENANT) | **200** (trước khi áp: **500**) |
| `GET /api/v1/occupancy-declarations/pending` (LANDLORD) | 200 |
| `GET /api/v1/occupancy-declarations/my` (TENANT) | 200 |
| `GET /api/v1/invoices/my` (LANDLORD, TENANT) | 200 |
| `GET /api/v1/invoices/preview?roomId=P.101&month=11&year=2026` | 200; `ready=false`, blocker `READING_REQUIRED` (chưa chốt chỉ số điện nước); `occupancy.declarationId` có giá trị, `occupants=1` (từ seed); `unitPrices.electricity=3500.00`, `unitPrices.water=15000.00`; `fees=null` |
| `POST /api/v1/invoices/generate` | **không chạy** trong đợt này (sẽ tạo hoá đơn nghiệp vụ); chỉ chạy khi có chỉ số điện nước thật |

Hai lỗi 500 gốc (`22P02` enum `IN_PROGRESS`, và các cột mới `notifications.read_at`,
`notifications.dedupe_key`, `conversations.task_id`, `messages.*`) đều do DB chưa
áp delta — đã hết sau khi áp + generate.

---

## 6. Test & kiểm tra đã chạy (không đụng DB)

| Hạng mục | Kết quả |
|---|---|
| `npx vitest run` (server, 34 file) | **385/385 pass**, gồm 3 integration dùng DB test |
| `tests/deployment/scripts.test.ts` | 30 pass (một-câu/lệnh, idempotent, cổng `--confirm`, predicate index, composite ảnh, DDL occupancy, verify predicate chuẩn hoá `IN → = ANY`, seed DEV) |
| `tests/services/occupancy.service.test.ts` | 19 pass |
| `tests/services/invoice.service.test.ts` | 20 pass |
| `tests/services/meterReading.service.test.ts` | 7 pass |
| `tests/validations/occupancy.validation.test.ts` | 9 pass |
| `npx tsc --noEmit` (server) | pass |
| `npx tsc --noEmit` (client) | pass |
| `npx next build` (client) | **pass** — có route `/landlord/occupancy`, `/tenant/occupancy` |
| `npx eslint .` (client) | 0 error / 132 warning (toàn bộ warning là cũ, không thuộc file mới) |
| Preflight 4 script (+ seed) | chạy thật trên DEV; trước khi áp §1.1, sau khi áp: "đã đúng đặc tả" toàn bộ |
| Guard host lạ / `NODE_ENV=production` | từ chối, exit 1 |

Đối chiếu `prisma/sql/*.sql` với `STATEMENTS` trong script: **khớp 100%**
(chỉ khác phần header comment để review).

---

## 7. File thay đổi (chính)

**Server — deploy/schema**
- `scripts/lib/target-guard.js` (mới), `scripts/lib/sql-statements.js`
- `scripts/apply-platform-delta.js`, `scripts/apply-batch3-lifecycle.js`,
  `scripts/apply-maintenance-task-index.js` (viết lại), `scripts/apply-occupancy-invoice-delta.js` (mới),
  `scripts/seed-dev-occupancy.js` (mới — seed `VERIFIED` cho DEV, có `--confirm`)
- `prisma/schema.prisma`, `prisma/sql/occupancy-invoice-delta.sql` (mới),
  `prisma/sql/platform-overhaul-delta.sql` (regenerate),
  `prisma/sql/maintenance_tasks_one_active_per_issue.sql` (4 trạng thái),
  `prisma/sql/batch-3-staff-completion-lifecycle.sql` (DROP legacy index)
- `package.json` (script ghi có `--confirm`, thêm `:preflight`, `db:occupancy:delta`)

**Server — nghiệp vụ**
- `src/services/occupancy.service.ts`, `invoice.service.ts` (viết lại phần tính tiền),
  `meterReading.service.ts`, `room.service.ts`
- `src/controllers/{occupancy,invoice,meterReading,room}.controller.ts`
- `src/routes/{occupancy,invoice,meterReading,room}.route.ts`, `src/app.ts`
- `src/validations/{occupancy,resource}.validation.ts`
- `src/services/roomDemand.service.ts` (mới — huỷ nhu cầu thuê/xem khi phòng đã thuê),
  `rental-request.service.ts`, `contract.service.ts`, `appointment.service.ts` (guard theo hợp đồng ACTIVE)

**Client**
- `components/landlord/room-form-modal.tsx` (mới, dùng cho tạo **và** sửa phòng)
- `app/landlord/rooms/page.tsx` (nút Sửa, giá điện/nước trên thẻ, cảnh báo sức chứa)
- `app/landlord/utilities/page.tsx` (viết lại: chọn kỳ, đầu kỳ lấy từ chỉ số trước, tiêu thụ)
- `app/landlord/invoices/page.tsx` (viết lại: preview + blockers + snapshot + xác nhận thu)
- `app/landlord/occupancy/page.tsx` (mới), `app/(tenant)/tenant/occupancy/page.tsx` (mới)
- `components/{landlord,tenant}/sidebar*`, `lib/api.ts`, `types/models.ts`
- `app/*/notifications/page.tsx` (hiển thị + điều hướng `OCCUPANCY`)

**Test**
- `tests/deployment/scripts.test.ts`, `tests/services/{occupancy,invoice,meterReading}.service.test.ts`,
  `tests/validations/occupancy.validation.test.ts`
- `tests/services/{roomDemand,rental-request,appointment}.service.test.ts` (mới),
  `tests/deployment/scripts.test.ts` (gate `db:demand:reconcile`)


---

## 8. Rollback (chỉ khi được duyệt riêng)

Delta chỉ thêm object. Nếu buộc phải lùi, thứ tự ngược lại và **chấp nhận mất**
dữ liệu khai báo/snapshot mới:

```sql
-- 4) occupancy (CHỈ khi chưa có dữ liệu cần giữ)
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_occupancy_declaration_id_fkey";
DROP INDEX IF EXISTS "invoices_occupancy_declaration_id_idx";
ALTER TABLE "invoices"
  DROP COLUMN IF EXISTS "occupancy_declaration_id",
  DROP COLUMN IF EXISTS "water_unit_price",
  DROP COLUMN IF EXISTS "electricity_unit_price",
  DROP COLUMN IF EXISTS "water_occupants",
  DROP COLUMN IF EXISTS "water_consumption",
  DROP COLUMN IF EXISTS "electricity_consumption",
  DROP COLUMN IF EXISTS "electricity_end",
  DROP COLUMN IF EXISTS "electricity_start";
DROP TABLE IF EXISTS "room_occupancy_declarations";

-- 3) index một-công-việc-đang-hoạt-động: KHÔNG nên lùi
--    (predicate hẹp cũ cho phép trùng task khi công việc đang IN_PROGRESS/SUBMITTED)
```

`ALTER TYPE … ADD VALUE` **không thể lùi** trong PostgreSQL. Vì vậy các enum
mới là vĩnh viễn sau khi áp.

---

## 9. Việc chưa làm / giới hạn đã biết

> Đã áp xong 79 câu + seed 3 khai báo `VERIFIED` (xem §11). Các mục dưới là giới hạn còn lại:

1. Hoá đơn cũ: snapshot `NULL` ⇒ UI hiển thị “Không có dữ liệu (hoá đơn cũ)”.
2. `npm run` trên Windows có thể che mã thoát 2 của script index (dùng `node` trực tiếp khi cần phân biệt).
3. Trang Điện nước hiển thị “Đã chốt kỳ này” dựa trên bản ghi **mới nhất** của
   phòng; nếu chốt lùi kỳ (tháng cũ hơn bản ghi mới nhất) thì UI vẫn cho nhập và
   server là nơi quyết định cuối cùng (`@@unique(roomId, month, year)`).
4. Chưa có endpoint/sửa UI cho việc **huỷ** khai báo đã VERIFIED; muốn đổi số
   người thì tenant khai lại (row mới PENDING, row cũ SUPERSEDED) — đúng thiết kế.

---

## 10. Biên bản duyệt (đã trả lời ngày 2026-11-13)

1. **Duyệt áp DDL trên Supabase DEV** — đồng ý, thực hiện đúng thứ tự §2.
2. **Chọn §4 phương án B** — seed khai báo `VERIFIED` cho dữ liệu DEV hiện có.
3. **Hiểu và chấp nhận** `ALTER TYPE ADD VALUE` không thể rollback.

---

## 11. Báo cáo nghiệm thu (kết quả chạy thật)

| Hạng mục | Kết quả |
|---|---|
| `db:platform:delta --confirm` | 44/44 ✅, verify 5 enum + 2 bảng + 18 cột + 10 index + 7 FK, số bản ghi không đổi |
| `db:batch3:lifecycle --confirm` | 11/11 ✅, enum có `IN_PROGRESS/SUBMITTED/COMPLETED`, composite `(task_id, kind)`, xoá index legacy |
| `db:index:one-active-task` | index đã có predicate 4 trạng thái ⇒ "đã ĐÚNG đặc tả", không làm gì |
| `db:occupancy:delta --confirm` | 23/23 ✅, verify 20 cột + 4 index + 6 FK, số bản ghi không đổi |
| `db:occupancy:seed:dev --confirm` | tạo 3 khai báo `VERIFIED` (P.101, 1, T-102), chạy lại là no-op |
| `prisma validate` / `generate` | schema valid / Prisma Client v6.19.3 |
| `prisma migrate diff … --exit-code` | **No difference detected (exit 0)** |
| 5 preflight đọc lại | tất cả "đã đúng đặc tả / không cần chạy lại" |
| `npx vitest run` (server) | **385/385 pass**, 34 file |
| `npx tsc --noEmit` (server) | pass |
| Smoke test API | notifications, chats/conversations (từng 500) nay **200**; preview trả `ready=false` + `READING_REQUIRED` + `occupants=1` |

### Sự cố gặp khi áp và cách xử lý

1. **Verify sai dương tính ở occupancy delta**: PostgreSQL chuẩn hoá
   `status IN ('PENDING','VERIFIED')` thành `= ANY (ARRAY[...])` trong
   `pg_get_expr`, nên so khớp nguyên văn luôn thất bại ⇒ script báo exit 1 dù
   index đã đúng. Đã sửa thành kiểm tra **từng mảnh ngữ nghĩa**
   (`predicateMatchesFragments`) + test hồi quy.
2. **`prisma migrate diff` báo lệch tên index**: delta tạo tên rút gọn, Prisma
   mong tên mặc định (`…_room_id_tenant_id_verified_at_idx`,
   `…_status_declared_at_idx`). Đã thêm 2 câu `DO $$` **đổi tên có điều kiện**
   (idempotent) và áp lại ⇒ diff về 0.
3. **`prisma generate` EPERM trên Windows**: `ts-node-dev` đang giữ
   `query_engine-windows.dll.node`; phải dừng server, generate, rồi chạy lại.
4. **Hai lỗi 500** ở `/notifications` và `/chats/conversations` (kèm `22P02`
   enum `IN_PROGRESS`) là do DB chưa áp delta — không phải lỗi logic; sau khi áp
   + generate đều trả 200.


---

## 12. Bổ sung: phòng đã thuê ⇒ huỷ mọi yêu cầu thuê / lịch xem (2026-11-13)

**Định nghĩa “đã thuê”**: phòng có hợp đồng `ACTIVE` **hoặc** `rooms.status = 'RENTED'`.

**Khi phòng chuyển sang đã thuê** — chủ trọ duyệt yêu cầu thuê, tạo hợp đồng,
hoặc kích hoạt hợp đồng — trong **cùng transaction** đánh dấu phòng `RENTED`:
- yêu cầu thuê còn `SUBMITTED`/`CONTRACT_READY` của phòng → `CANCELLED`
  (trừ yêu cầu vừa được duyệt);
- lịch xem còn `PENDING`/`CONFIRMED` → `CANCELLED`, khớp theo `room_id` hoặc
  theo bài đăng của chính phòng (`posts.room_id`), vì lịch tạo từ tin đăng có
  thể thiếu `room_id`;
- lịch sử (`REJECTED`, `SIGNED`, `COMPLETED`, `CANCELLED`) không bị sửa.

Cài đặt: `src/services/roomDemand.service.ts` (`cancelOpenDemand` +
`notifyCancelledDemand`), gọi từ `rental-request.service.ts`,
`contract.service.ts` (tạo + kích hoạt hợp đồng). Thông báo gửi **sau commit**,
mỗi bản ghi một `dedupeKey` (`room-rented:rental-request:<id>`,
`room-rented:appointment:<id>`); lỗi thông báo không biến giao dịch đã commit
thành 500.

**Chặn tạo nhu cầu mới (defence in depth)**: `POST /rental-requests` và
`POST /appointments` trả 400 khi phòng (trực tiếp hoặc qua bài đăng) không còn
`AVAILABLE` **hoặc** đã có hợp đồng `ACTIVE`. Nhờ vậy một `rooms.status` sai do
dữ liệu cũ cũng không mở lại đường tạo yêu cầu/đặt lịch cho phòng đã thuê.

**Reconcile dữ liệu DEV** (`scripts/reconcile-room-demand.js`, chỉ chạy target
DEV + `--confirm`, idempotent, không xoá bản ghi):

| Lệnh | Kết quả thật trên DEV |
| --- | --- |
| `npm run db:demand:reconcile:preflight` | 1 phòng lệch (`Dãy Trọ Bình Yên / P.101`: có hợp đồng `ACTIVE` nhưng vẫn `AVAILABLE`) + 2 lịch xem mở (`CONFIRMED`, `PENDING`) |
| `npm run db:demand:reconcile --confirm` | rooms → `RENTED`: **1**; rental_requests → `CANCELLED`: 0; appointments → `CANCELLED`: **2**; đọc lại: 0 lệch / 0 yêu cầu mở / 0 lịch mở |
| chạy lại `:preflight` | “Không có gì lệch” ⇒ idempotent |

**Kiểm thử**: `npx vitest run` **385/385 pass** (34 file), `npx tsc --noEmit`
sạch. Test mới: `tests/services/roomDemand.service.test.ts`,
`tests/services/rental-request.service.test.ts`,
`tests/services/appointment.service.test.ts`; `tests/deployment/scripts.test.ts`
bổ sung gate preflight/`--confirm` cho script reconcile.

**Ghi chú UI**: trang `/(tenant)/tenant/rental-requests` vẫn map `CANCELLED` →
nhãn “Đã từ chối” (giữ nguyên hiển thị cũ); nội dung thông báo nói rõ lý do
“phòng đã được cho thuê”.

---

## 13. Phiên 2 giờ, quyền nhân viên, thông báo & các thay đổi UI (DEV)

### 13.1 Phiên đăng nhập tối đa 2 giờ
- `REFRESH_TOKEN_TTL_MS = 2h`; mỗi lần rotate, refresh token mới **kế thừa hạn
  tuyệt đối** của token gốc (`min(stored.expiresAt, now + 2h)`) nên không thể
  gia hạn phiên bằng cách gọi `/auth/refresh` liên tục.
- `JWT_EXPIRES_IN=2h` trong `.env.example`/`README`; access token vẫn ngắn hạn
  (15 phút) và được refresh trong hạn phiên.
- Client: `5k_session_expires_at` (đặt một lần lúc đăng nhập) + `SessionGuard`
  toàn cục; quá hạn ⇒ xoá sạch token/hồ sơ/tuỳ chọn thông báo, `location.replace`
  `/login?expired=1`. API client chặn request trước khi gửi và không refresh khi
  phiên đã hết hạn.
- `logout()` xoá phiên **trước**, sau đó thu hồi refresh token (best effort, tối
  đa 5 giây) và tải lại trang đăng nhập — không cần F5.

### 13.2 Nhân viên được chủ trọ cấp quyền
- `GET /api/v1/staff/membership/me` (mọi tài khoản đã đăng nhập) trả membership
  đang hoạt động; quản lý/cấp quyền vẫn chỉ dành cho LANDLORD.
- Các route chủ trọ chuyển sang `authorizeStaffOr(permission, ...)` và controller
  dùng `resourceOwnerId(req)` (bất động sản/phòng, bảo trì, hoá đơn, lịch hẹn,
  thuê/hợp đồng, số người ở, tin đăng, thống kê tổng quan).
- Client: `LandlordAccessProvider` chặn `/landlord/*` khi không có membership,
  ẩn menu theo quyền, và chặn URL trực tiếp thiếu quyền → `/403`.

### 13.3 Thông báo & trang chi tiết
- Trang thông báo đầy đủ cho **admin**, **staff** (trước đây chỉ tenant/landlord);
  chi tiết thông báo `/<portal>/notifications/[id]` cho cả 4 portal.
- `resolveNotificationTarget` ánh xạ đúng đích: TASK/OFFER/REVIEW →
  `/landlord/maintenance-tasks/[id]` hoặc `/staff/tasks/[id]`; POST → danh sách
  tin; INVOICE/CONTRACT/OCCUPANCY/MESSAGE → trang tương ứng của portal.
- Thêm `/landlord/maintenance-tasks/[id]` (duyệt/yêu cầu làm lại nghiệm thu, giao
  việc, thương lượng, đánh giá, tranh chấp) và `/staff/tasks/[id]` (ứng tuyển,
  bắt đầu, gửi nghiệm thu kèm ảnh).
- Thông báo mới: chủ trọ nhận khi khách thuê tạo sự cố; admin nhận khi có hồ sơ
  KYC mới.
- Trang cá nhân công khai `/users/[id]` theo role (staff: kỹ năng/kinh nghiệm/
  đánh giá; landlord: quy mô cơ sở; tenant: mô tả/nghề nghiệp), liên kết từ chợ
  thợ, danh sách khách thuê, danh sách người dùng của admin và hồ sơ tenant.
  Server `GET /users/:id/public-profile` **không** trả email/SĐT/toạ độ.

### 13.4 Nước tính theo số người ở
- Hoá đơn dùng số người **đã xác minh**; chưa xác minh ⇒ mặc định **1 người**
  (không còn blocker 409/`OCCUPANCY_NOT_VERIFIED`). Snapshot vẫn ghi
  `waterOccupants`/`occupancyDeclarationId` (null khi dùng mặc định) và preview
  trả `occupancy.verified`.

### 13.5 Khác
- `REQUEST_TIMEOUT_MS = 7000` cho mọi request client; quá hạn ⇒ `ApiTimeoutError`
  (408) với thông báo tiếng Việt.
- Chat **chỉ gửi văn bản**: bỏ UI/route upload ảnh; client gửi JSON
  `{ content, clientMessageId }`.
- Hồ sơ thợ dùng `AddressFields` (chọn tỉnh → phường từ JSON hành chính có sẵn);
  toạ độ chỉ là tuỳ chọn.
- `npx prisma db push`: “The database is already in sync with the Prisma schema.”

### 13.6 Đăng nhập & không gian thợ
- Sau khi đăng nhập, **mọi role đều về trang chủ `/`** (không tự chuyển vào
  dashboard/không gian riêng); người dùng mở không gian của mình từ menu tài khoản.
- Khu vực thợ (`/staff/*`) dùng layout portal riêng có sidebar giống chủ trọ/quản
  trị/khách thuê: Việc làm & ứng tuyển, Hồ sơ & kỹ năng, Xác minh CCCD, Thông báo.
  `/staff` chuyển thẳng tới `/staff/profile`.
- `LandlordAccessProvider` **không còn return sớm** khi đang kiểm tra quyền; luôn
  render subtree và phủ overlay. Tránh lỗi Next 16 “segment was dropped from
  rendering / instant navigation” cho `/landlord/*`.



