# Batch 2 — Maintenance Task Marketplace

> **Lưu ý đường dẫn test (cập nhật Batch 4):** test đã chuyển từ `server/src/**` sang `server/tests/**`
> (giữ nguyên tên file; `src/services/x.test.ts` → `tests/services/x.test.ts`). Các lệnh
> `npx vitest run src/...` dưới đây là bản ghi lịch sử; chạy lại bằng `npm test` hoặc đổi tiền tố.

Status: **implemented in source, statically verified, and applied to Supabase DEV**
on 2026-12-11 (§7). Runtime UAT (§10) has not been executed yet because it needs
three authenticated browser sessions (landlord, staff, admin). No production
database was contacted, migrated or seeded at any point.

**Business-flow correction (§11, same day):** the marketplace task is now created
**from a tenant-reported issue** instead of being published out of thin air.
`source_issue_id` is mandatory and `POST /api/v1/maintenance-tasks` was removed
(Variant B, §11.7). Code is implemented and verified, and the **schema delta is
applied to Supabase DEV and verified read-only** (§11.3).

Batch 1 (role + staff profile foundation, shared KYC) is untouched: this batch
reuses it instead of re-implementing it.

## 1. Files changed

### Server (`server/`)

| File | Change |
| --- | --- |
| `prisma/schema.prisma` | **additive** — 2 enums, 4 models, `NotificationType.TASK`, relation fields on `User`/`Property`/`Room` |
| `src/utils/geo.ts` | **new** — Haversine distance, coordinate normalisation, bounding box, antimeridian-safe longitude ranges |
| `src/validations/maintenanceTask.validation.ts` | **new** — task create/update, browse/filter query, application payload |
| `src/validations/staffProfile.validation.ts` | extended browse query with `latitude`/`longitude`/`radiusKm`/`sort` + cross-field rules |
| `src/services/maintenanceTask.service.ts` | **new** — task creation/update/cancel, landlord list, viewer-scoped detail, staff discovery by distance |
| `src/services/maintenanceApplication.service.ts` | **new** — apply/withdraw, landlord review list, atomic accept, reject |
| `src/services/staffProfile.service.ts` | distance ordering + radius filtering for `POST /staff-marketplace/browse` (coordinates never returned) |
| `src/controllers/maintenanceTask.controller.ts` | **new** |
| `src/controllers/staffProfile.controller.ts` | passes the new geo query parameters |
| `src/routes/maintenanceTask.route.ts` | **new** — mounted at `/api/v1/maintenance-tasks` |
| `src/app.ts` | mounts `maintenanceTaskRoute` |
| `src/utils/geo.test.ts` | **new** — 12 tests |
| `src/validations/maintenanceTask.validation.test.ts` | **new** — 9 tests (multipart parsing, coord pairing, schedule/budget rules) |
| `src/services/maintenanceTask.service.test.ts` | **new** — 13 tests |
| `src/services/maintenanceApplication.service.test.ts` | **new** — 18 tests |
| `src/services/staffProfile.service.test.ts` | updated the public-payload assertion (coords are now *read* server-side but still never returned) + 1 distance test |
| `docs/BATCH-2-TASK-MARKETPLACE.md` | **new** (this file) |
| `docs/BATCH-1-STAFF-FOUNDATION.md` | §7 next-step notes updated to point at what Batch 2 delivered |
| `src/services/maintenance.service.ts` | §11 — issue images + `category`, landlord triage, owner-scoped detail, shared `issueSelect` |
| `src/services/maintenanceTask.service.ts` | §11 — `createFromIssue` (issue → task, prefill, duplicate guard, Serializable), Cloudinary asset ownership guard; direct `create` **deleted** (Variant B) |
| `src/controllers/maintenanceTask.controller.ts` | §11 — `create` **deleted** (no direct task creation) |
| `src/routes/maintenanceTask.route.ts` | §11 — `POST /` **removed** |
| `src/controllers/maintenance.controller.ts` | §11 — `getById`, `triage`, `createTaskFromIssue` |
| `src/routes/maintenance.route.ts` | §11 — `PATCH /:id/triage`, `POST /:id/tasks`, `GET /:id`, multipart on tenant create |
| `src/validations/resource.validation.ts` | §11 — `category` on issue create, `maintenanceTriageSchema` (reason required when rejecting / asking for info) |
| `src/validations/maintenanceTask.validation.ts` | §11 — `maintenanceTaskFromIssueSchema` (no `propertyId`/`roomId`/`address` from client) |
| `src/services/maintenanceTask.fromIssue.test.ts` | §11 — **new**, 8 tests |
| `src/validations/maintenanceIssue.validation.test.ts` | §11 — **new**, 6 tests |

### Client (`client/`)

| File | Change |
| --- | --- |
| `types/models.ts` | `MaintenanceTask*` types, `MaintenanceApplicationStatus`, `NotificationType.TASK`, `StaffProfile.distanceKm`, geo fields on `StaffBrowseQuery` |
| `lib/api.ts` | `maintenanceTasks` namespace (11 calls); distance-aware `staffMarketplace.browse` |
| `lib/labels.ts` | task/application/urgency labels |
| `app/landlord/maintenance-tasks/page.tsx` | **new** — own task list, applicant review, accept/reject, cancel (§11: the create form was removed — tasks come from issues) |
| `app/landlord/staff-marketplace/page.tsx` | **new** — staff discovery with skill/availability/radius filters, server-computed distance |
| `app/staff/tasks/page.tsx` | **new** — open-task browsing, apply/withdraw, my applications, KYC/availability guidance |
| `components/landlord/sidebar.tsx` | 2 nav entries in VẬN HÀNH; active-link matching narrowed to path segments so `/landlord/maintenance` no longer lights up on `/landlord/maintenance-tasks` |
| `app/staff/layout.tsx` | "Việc làm" nav entry |
| `app/(tenant)/tenant/maintenance/page.tsx` | §11 — **new** — tenant reports an issue (room from ACTIVE contracts, category, urgency, up to 5 photos) and tracks triage/linked task |
| `app/landlord/maintenance/page.tsx` | §11 — **rewritten** — issue review (triage + evidence photos) and "create task from issue"; the tenant-only POST is no longer called from the landlord page |
| `components/tenant/portal-sidebar.tsx` | §11 — "Báo cáo sự cố" nav entry |
| `lib/labels.ts` | §11 — `translateTriageStatus`, `TRIAGE_STATUS_OPTIONS` |
| `types/models.ts` + `lib/api.ts` | §11 — issue images/category/triage/`tasks` types, `maintenance.getById/updateTriage/createTaskFromIssue`, `create` accepts `FormData` |

## 2. Features implemented

Landlord:
- Create a maintenance task for **a property they own** (server verifies
  `properties.landlord_id`), with an optional room inside that property, title,
  description, category, required skills, address, coordinates, budget range,
  urgency, preferred schedule, extra instructions and up to 5 images.
- Edit an `OPEN` task (property is immutable), cancel an `OPEN` task.
- See their own tasks with the application count, review each applicant's
  profile (skills, description, price range, availability, KYC state, phone) and
  accept exactly one of them.

Staff:
- Browse `OPEN` tasks with search / category / skill / urgency / radius filters,
  sorted newest, most urgent, or nearest (server-side Haversine).
- Apply (KYC-gated, eligibility-checked, duplicate-proof) and withdraw while the
  application is still `PENDING`.
- See every application they sent and its current status.

Landlord discovery (Batch 1 endpoint extended):
- `POST /api/v1/staff-marketplace/browse` accepts `latitude`, `longitude`,
  `radiusKm`, `sort=nearest` in the JSON **body**. Location data must not travel
  in a GET query string (access logs, browser history, referer); `GET
  /api/v1/staff-marketplace` only accepts non-sensitive filters. Staff without
  coordinates are excluded from radius searches and get `distanceKm: null`
  otherwise. A staff member's coordinates are still never returned.

Notifications (existing `notificationService`, persisted first, socket second):
new application (→ landlord), application accepted (→ staff), application
rejected (→ staff), task assigned (→ landlord), pending applications rejected
because the task was cancelled (→ each staff).

## 3. API endpoints added / modified

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| ~~`POST`~~ | ~~`/api/v1/maintenance-tasks`~~ | — | **REMOVED by §11.7 (Variant B)** — tasks are only created from an issue: `POST /api/v1/maintenance/:id/tasks` |
| `GET` | `/api/v1/maintenance-tasks/mine` | `LANDLORD` | optional `status=OPEN|ASSIGNED|CANCELLED` |
| `PATCH` | `/api/v1/maintenance-tasks/:id` | `LANDLORD` | owner only, `OPEN` only |
| `POST` | `/api/v1/maintenance-tasks/:id/cancel` | `LANDLORD` | owner only, conditional on `status = OPEN` |
| `GET` | `/api/v1/maintenance-tasks/:id` | any authenticated | scope depends on viewer (see §6) |
| `GET` | `/api/v1/maintenance-tasks/:id/applications` | `LANDLORD` | owner only, 404 otherwise |
| `POST` | `/api/v1/maintenance-tasks/:id/applications/:applicationId/accept` | `LANDLORD` | atomic assignment |
| `POST` | `/api/v1/maintenance-tasks/:id/applications/:applicationId/reject` | `LANDLORD` | pending applications only |
| `GET` | `/api/v1/maintenance-tasks` | `STAFF` | open tasks; non-sensitive filters only: `category`, `skill`, `urgency`, `search`, `sort=newest|urgency`, `page`, `limit` |
| `POST` | `/api/v1/maintenance-tasks/browse` | `STAFF` | body variant for distance search: adds `latitude`, `longitude`, `radiusKm`, `sort=nearest` without putting location in the URL |
| `POST` | `/api/v1/maintenance-tasks/:id/applications` | `STAFF` | body `{ message? }`; KYC + eligibility enforced in-transaction |
| `DELETE` | `/api/v1/maintenance-tasks/:id/applications/me` | `STAFF` | withdraw a `PENDING` application |
| `GET` | `/api/v1/maintenance-tasks/applications/mine` | `STAFF` | own applications with task summary |
| `GET` | `/api/v1/staff-marketplace` | `LANDLORD`, `ADMIN` | **modified**: non-sensitive filters only; items gain `distanceKm` when returned from the POST variant |
| `POST` | `/api/v1/staff-marketplace/browse` | `LANDLORD`, `ADMIN` | JSON body: `latitude`, `longitude`, `radiusKm`, `sort=nearest`; items gain `distanceKm` |

"Filter by KYC-approved status" is a **hard filter**, not a parameter: only
`kyc_submissions.status = APPROVED` staff are ever returned (Batch 1
`activeStaffUser`), so offering `kycStatus=APPROVED|PENDING` would only create a
way to ask for results that must never exist. Inactive or unapproved staff are
simply not discoverable.

Machine-readable error codes (`AppError.code`): `STAFF_KYC_REQUIRED`,
`TASK_NOT_OPEN`, `TASK_ALREADY_ASSIGNED`, `TASK_STATE_CONFLICT`,
`TASK_PROPERTY_IMMUTABLE`, `DUPLICATE_APPLICATION`,
`APPLICATION_ALREADY_ACCEPTED`, `APPLICATION_ALREADY_REVIEWED`,
`APPLICATION_STATE_CONFLICT`, `APPLICATION_LOCKED`, `APPLICATION_NOT_PENDING`,
`STAFF_PROFILE_REQUIRED`, `STAFF_NOT_AVAILABLE`, `STAFF_NOT_ELIGIBLE`,
`STAFF_ROLE_REQUIRED`, `STAFF_SKILL_MISMATCH`, `ACCOUNT_INACTIVE`.

## 4. State model and lifecycle

Task status is modelled **separately** from application status; the brief's
`APPLIED` state is deliberately not a task state.

| Enum | Values | Transitions enforced |
| --- | --- | --- |
| `MaintenanceTaskStatus` | `OPEN`, `ASSIGNED`, `CANCELLED` | `OPEN → ASSIGNED` (accept only), `OPEN → CANCELLED` (owner cancel only). No other transition exists in code. |
| `MaintenanceApplicationStatus` | `PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN` | `PENDING → ACCEPTED` (accept), `PENDING → REJECTED` (explicit reject, auto-reject on assignment, cancel), `PENDING → WITHDRAWN` (staff), `REJECTED`/`WITHDRAWN → PENDING` (re-apply reuses the same row) |

Why `APPLIED` is not a task state: "has applicants" is a property of the
application table (`count`), not of the job. Folding it into the task enum makes
withdraw/reject need reverse transitions and cannot express "two pending
applications at the same time".

Batch 3 states (`NEGOTIATING`, `AGREED`, `IN_PROGRESS`, `COMPLETED`) are **not**
declared anywhere.

## 5. KYC gate enforcement points

`assertKycApproved(await loadKycState(userId, tx), '<verb>')` — the `tx` client is
passed so the read happens inside the same transaction as the write:

| Entry point | Where | Result when not `APPROVED` |
| --- | --- | --- |
| Apply for a task | `maintenanceApplicationService.apply` (inside `$transaction`, before any write) | `403 STAFF_KYC_REQUIRED`, nothing written |
| Accept an application (assign work) | `maintenanceApplicationService.accept` (inside the assignment transaction, before the claim) | `403 STAFF_KYC_REQUIRED`, claim rolled back |
| Turn availability ON | `staffProfileService.updateAvailability` / `updateProfile` (Batch 1, unchanged) | `403 STAFF_KYC_REQUIRED` |
| Appear in discovery | `staffProfileService.browse` / `getPublicProfile` (Batch 1 `activeStaffUser` filter) | not listed at all |

Client-side, the apply button is hidden unless the staff's own profile reports
`kycStatus === 'APPROVED'`, but that is presentation only: the server never trusts
a client-supplied KYC state, and the gate re-reads `kyc_submissions` every time.


## 6. Authorization and concurrency protections

Authorization (all enforced in services/controllers, never only in routes):

| Risk | Protection |
| --- | --- |
| Landlord A creates work on Landlord B's property | `property.findFirst({ id, landlordId })` → 404 if not owned (the client's `propertyId` is never trusted) |
| Room from another property | `room.findFirst({ id, propertyId })` → 400 |
| Landlord edits/cancels someone else's task | `where: { id, landlordId }` + 404 (not 403, so existence is not confirmed) |
| Tenant/other role creating tasks | `authorize('LANDLORD')` on the route **and** ownership checks in the service |
| Staff assigning themselves | accept/reject routes are `authorize('LANDLORD')` + owner check; there is no staff-side accept endpoint |
| Landlord reading another landlord's applications | `listForTask` requires `taskId + landlordId` → 404 |
| IDOR on task detail | owner/admin/assignee/applicant scoping; outsiders only see `OPEN` tasks, everything else 404 |
| Leaking applicant contact details | phone only for the task owner/admin (list) and the assignee (detail); staff coordinates never returned |
| Inactive/suspended accounts | `authenticate` rejects inactive users; apply re-checks `isActive` and `role = STAFF` inside the transaction; accept re-checks both |
| Direct API calls bypassing the UI | every rule above lives server-side; the UI only mirrors it |

Concurrency / data integrity:

| Rule | Mechanism |
| --- | --- |
| Exactly one assignment per task | `maintenanceTask.updateMany({ where: { id, landlordId, status: 'OPEN' } })` — the loser of a race gets `count = 0` → `409 TASK_ALREADY_ASSIGNED`, whole transaction rolls back |
| Second layer for the same rule | `maintenance_tasks.assigned_application_id` is `UNIQUE` |
| Assignment vs. application state | `updateMany({ where: { id, status: 'PENDING' } })` for the accepted row → `409 APPLICATION_STATE_CONFLICT` |
| Cancel vs. assign race | cancel uses `updateMany({ where: { status: 'OPEN' } })` → `409 TASK_STATE_CONFLICT` |
| Duplicate / concurrent applications | `@@unique([taskId, staffId])` + `PENDING` check inside the transaction |
| Withdraw vs. accept race | withdraw is `updateMany({ where: { status: 'PENDING' } })`; an already-accepted application is `409 APPLICATION_LOCKED` |
| KYC changed between apply and assign | KYC is re-read inside the accept transaction |
| Notification for a rolled-back action | notifications are emitted only after commit; a notification failure cannot undo the committed write |

Existing H-05 invariants are untouched: `authVersion` enforcement, password
provenance, refresh-token rotation and socket session invalidation live in
`auth.middleware.ts` / auth services and were not modified.

Deliberate asymmetry: `is_available` is required **when applying** but not
re-checked when the landlord assigns — a staff member who briefly toggled
availability off after applying must not block the landlord's committed decision
(they can still withdraw before it happens). KYC is re-checked at assignment
because it is an identity precondition, not a preference.

## 7. Schema delta (additive only)

Nothing is dropped, renamed, narrowed or back-filled. `Role.AGENT`, all existing
tables and all existing enum values are untouched. The `UPDATE`/enum-removal work
listed in Batch 1 §5.3 is still blocked and is **not** part of this batch.

Added enums:
- `MaintenanceTaskStatus` (`OPEN`, `ASSIGNED`, `CANCELLED`)
- `MaintenanceApplicationStatus` (`PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`)

Added enum value:
- `NotificationType.TASK`

Added tables (9 indexes, 1 unique index on `maintenance_tasks`, 1 composite unique
on applications, 9 foreign keys):
- `maintenance_tasks` (`assigned_application_id` UNIQUE)
- `maintenance_task_skills` (PK `task_id + category`)
- `maintenance_task_images`
- `maintenance_task_applications` (UNIQUE `task_id + staff_id`)

Added relation fields only (no columns):
- `users`: `maintenanceTasks`, `assignedMaintenanceTasks`, `maintenanceTaskApplications`
- `properties`: `maintenanceTasks`
- `rooms`: `maintenanceTasks`

Data-migration risk: **none**. New tables start empty, the enum value is only
added, and no existing row is read or transformed. The FK
`maintenance_tasks.assigned_application_id → maintenance_task_applications.id`
is created after both tables exist, so there is no ordering problem.

Re-verified against `HEAD:server/prisma/schema.prisma` after the final edits: the
generated script is **33 statements, all additive** — 2 `CREATE TYPE`, 1
`ALTER TYPE … ADD VALUE`, 4 `CREATE TABLE`, 2 `CREATE UNIQUE INDEX`, 7
`CREATE INDEX`, 9 `ALTER TABLE … ADD CONSTRAINT` — with **zero** `DROP`,
`ALTER COLUMN`, `RENAME`, `SET NOT NULL` or `UPDATE` statements.


### SQL preview

Generated offline with
`npx prisma migrate diff --from-schema-datamodel <HEAD schema> --to-schema-datamodel prisma/schema.prisma --script`
(no database connection was opened):

```sql
-- CreateEnum
CREATE TYPE "MaintenanceTaskStatus" AS ENUM ('OPEN', 'ASSIGNED', 'CANCELLED');
CREATE TYPE "MaintenanceApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TASK';

-- CreateTable
CREATE TABLE "maintenance_tasks" (
    "id" TEXT NOT NULL,
    "landlord_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "room_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "budget_min" DECIMAL(12,2),
    "budget_max" DECIMAL(12,2),
    "urgency" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "preferred_start_at" TIMESTAMP(3),
    "preferred_end_at" TIMESTAMP(3),
    "additional_instructions" TEXT,
    "status" "MaintenanceTaskStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_staff_id" TEXT,
    "assigned_application_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "maintenance_task_skills" (
    "task_id" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_task_skills_pkey" PRIMARY KEY ("task_id","category")
);

CREATE TABLE "maintenance_task_images" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_task_images_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "maintenance_task_applications" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "message" TEXT,
    "status" "MaintenanceApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "maintenance_task_applications_pkey" PRIMARY KEY ("id")
);
```

Indexes and foreign keys (exact names from the generated script):

```sql
CREATE UNIQUE INDEX "maintenance_tasks_assigned_application_id_key" ON "maintenance_tasks"("assigned_application_id");
CREATE INDEX "maintenance_tasks_status_category_idx" ON "maintenance_tasks"("status", "category");
CREATE INDEX "maintenance_tasks_status_urgency_idx" ON "maintenance_tasks"("status", "urgency");
CREATE INDEX "maintenance_tasks_landlord_id_status_idx" ON "maintenance_tasks"("landlord_id", "status");
CREATE INDEX "maintenance_task_skills_category_idx" ON "maintenance_task_skills"("category");
CREATE INDEX "maintenance_task_images_task_id_idx" ON "maintenance_task_images"("task_id");
CREATE INDEX "maintenance_task_applications_task_id_status_idx" ON "maintenance_task_applications"("task_id", "status");
CREATE INDEX "maintenance_task_applications_staff_id_status_idx" ON "maintenance_task_applications"("staff_id", "status");
CREATE UNIQUE INDEX "maintenance_task_applications_task_id_staff_id_key" ON "maintenance_task_applications"("task_id", "staff_id");

ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_assigned_application_id_fkey" FOREIGN KEY ("assigned_application_id") REFERENCES "maintenance_task_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_task_skills" ADD CONSTRAINT "maintenance_task_skills_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_task_images" ADD CONSTRAINT "maintenance_task_images_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_task_applications" ADD CONSTRAINT "maintenance_task_applications_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_task_applications" ADD CONSTRAINT "maintenance_task_applications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Applied to Supabase DEV

Approved and applied on **2026-12-11**. Target (from `server/.env` → `DB_URL`,
password never printed): `aws-0-ap-northeast-1.pooler.supabase.com:5432`,
database `postgres`, schema `public`.

```bash
cd server
npx prisma validate    # exit 0 — "The schema at prisma/schema.prisma is valid"
npx prisma db push     # exit 0 — "Your database is now in sync ... Done in 7.74s"
npx prisma generate    # ran automatically — Prisma Client v6.19.3 regenerated
```

Post-apply verification against the live database (read-only `information_schema`
/ `pg_catalog` queries):

| Check | Result |
| --- | --- |
| Tables created | `maintenance_tasks`, `maintenance_task_skills`, `maintenance_task_images`, `maintenance_task_applications` |
| Indexes on those tables | 13 (9 from this delta + 4 primary keys) |
| Foreign keys | 9 |
| `MaintenanceTaskStatus` | `OPEN`, `ASSIGNED`, `CANCELLED` |
| `MaintenanceApplicationStatus` | `PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN` |
| `NotificationType` | previous 8 values **plus** `TASK` (appended, none removed) |
| Row counts | 0 / 0 / 0 / 0 — new tables are empty, so no data migration occurred |

Prisma query-shape verification (read-only, mirrors the services): `getMine`
select + `_count`, `browseOpen` bounding-box/filter/sort, applicant select with
`staff → staffProfile → skills` and `kycSubmission`, the `taskId_staffId` unique
lookup, the conditional claim `updateMany` (executed then rolled back), and a
`type: 'TASK'` notification query — all `OK`, exit 0.

`prisma db push` was run **without** `--accept-data-loss`; the delta contained no
destructive statement, so no prompt was ever raised.


## 8. Verification performed

| Command | Result |
| --- | --- |
| `npx prisma validate` | exit 0 — “The schema at prisma/schema.prisma is valid” |
| `npx prisma migrate diff --from-schema-datamodel <HEAD> --to-schema-datamodel prisma/schema.prisma --script` | exit 0 — output is exactly §7 (offline, no connection) |
| `npx prisma generate` | exit 0 — client regenerated so `tsc` can see the new models (writes only `node_modules`, **no database access**) |
| `npx prisma db push` (approved, §7) | exit 0 — "Your database is now in sync … Done in 7.74s" on the DEV project; no `--accept-data-loss`, no prompt |
| live schema verification (read-only) | 4 tables, 13 indexes, 9 FKs, 3 enums with expected values, 0 rows |
| live Prisma query-shape check (read-only) | 6/6 `OK` — `getMine`, `browseOpen`, applicant select, unique lookup, rolled-back claim, `NotificationType.TASK` |
| boot smoke (ts-node, `PORT=4711`, real `.env` → DEV) | server printed "🚀 Server is running", empty stderr (so zod env validation passed); `GET /maintenance-tasks/mine`, `GET /maintenance-tasks`, `GET /maintenance-tasks/applications/mine`, `GET /staff-marketplace` each returned **401** — i.e. the request reached route-level auth, proving the router is mounted (an unmounted path would be 404); process stopped afterwards |
| server `npx tsc --noEmit` | exit 0 |
| client `npx tsc --noEmit` | exit 0 |
| client `npx eslint` on the 8 changed files | exit 0 |
| server `npx vitest run` (full suite) | **151 passed / 17 files** |

Focused suites (new + touched):

| File | Tests |
| --- | --- |
| `src/services/maintenanceApplication.service.test.ts` | 18 |
| `src/services/maintenanceTask.service.test.ts` | 13 |
| `src/validations/maintenanceTask.validation.test.ts` | 9 |
| `src/utils/geo.test.ts` | 12 |
| `src/services/staffProfile.service.test.ts` | 18 (16 before this batch) |
| `src/services/kycGate.service.test.ts` | 12 |

Mapped to the tests the brief asked for:

| Required test | Where |
| --- | --- |
| Property ownership | `maintenanceTaskService.create` → “từ chối khi cơ sở không thuộc chủ trọ đang đăng nhập”, room-ownership case |
| Staff KYC gate | `maintenanceApplicationService.apply` → 3 KYC tests (NONE/PENDING/REJECTED + tx client) and `accept` → “KYC vừa bị từ chối thì không giao việc” |
| Duplicate applications | `apply` → “đơn PENDING trùng bị chặn” |
| Assignment concurrency | `accept` → “request thua cuộc đua nhận 409 và không ghi đơn nào” |
| Unauthorized task access | `getById` → other-landlord 404, `listForTask` → 404 + no query |
| Inactive staff restrictions | `apply` → `ACCOUNT_INACTIVE`, plus `STAFF_PROFILE_REQUIRED` / `STAFF_NOT_AVAILABLE` / `STAFF_SKILL_MISMATCH` |
| Invalid task state transitions | `cancel` → assigned task 409, race 409; `withdraw` → accepted 409, race 409 |

Known environment note: `npm test` (which loads `.env.test`) currently fails at
fixture creation with `The column auth_version does not exist in the current
database` — the database behind `.env.test` is behind the H-05 schema and
therefore also behind this one. That drift predates Batch 2 and is unrelated to
these changes; it is *not* fixed here because syncing a **second** database is a
separate write. `npx vitest run` (default env, mocked Prisma) is green.

## 9. What is deliberately NOT done

- No price negotiation, agreement, start/finish or completion workflow (Batch 3).
- No un-assign / re-open after assignment (Batch 3), so `ASSIGNED` and
  `CANCELLED` are terminal in Batch 2.
- No charge, escrow or invoice for a task.
- No notification redesign (Batch 6) — only the four persisted TASK notifications
  required by the brief, through the existing `notificationService`.
- No changes to Batch 1 KYC behaviour, copy or payloads; `GET /staff-marketplace`
  only gained optional geo parameters and a `distanceKm` field.
- Database work was limited to the approved, additive §7 sync of the Supabase
  **DEV** project (`prisma db push`, no `--accept-data-loss`, no seed, no fixture,
  no row written). Production was never contacted. Post-sync verification was
  read-only.
- The client's global API layer redirects **any** 403 to `/403`. The marketplace
  UI therefore hides the apply action until KYC is approved and availability is on,
  so the normal path never trips that redirect; a race (KYC revoked between page
  load and click, or a skill mismatch) still lands on `/403` with the server's
  message in the network tab. Changing that global behaviour was out of scope.

## 10. Runtime UAT still owed (schema is now applied; the endpoints are live)

Prerequisite: `server/.env` points at the synced DEV project, the API is running,
and one account exists per role (landlord, staff with/without approved KYC,
admin). No test data is seeded by this batch — UAT creates its own.

1. Landlord creates a task with images on an owned property; a second landlord
   gets 404 when posting to that property id.
2. Staff without KYC cannot apply (403 `STAFF_KYC_REQUIRED`); after admin
   approval the application succeeds; a rejected staff disappears from discovery.
3. Two simultaneous accepts yield one `ASSIGNED` task and one 409.
4. Availability toggled off blocks applying, while existing applications remain
   visible.
5. Landlord KYC flow (Batch 1) still works unchanged.
6. **§11 flow:** tenant reports an issue with photos on a room with an ACTIVE
   contract; a second tenant/landlord cannot read it (404). Landlord marks it
   `NEEDS_INFO` without a reason → 400; with a reason → 200. Landlord creates the
   task from the issue → task appears with the issue's photos and the issue shows
   `REVIEWED`; a second conversion of the same issue → 409 `ISSUE_ALREADY_HAS_TASK`.

## 11. Business-flow correction — a task must originate from a tenant issue

### 11.1 What was wrong

The first Batch 2 cut let the landlord publish a marketplace task directly
(`POST /maintenance-tasks` with `propertyId` + `address`). The intended workflow
is **tenant reports → landlord reviews → landlord recruits staff → staff applies →
landlord assigns**. The tenant side already existed (`/api/v1/maintenance`,
`MaintenanceRequest`) but was disconnected from the marketplace, had no photos,
no category and no way for the landlord to answer "seen / needs info / rejected".
The landlord page even called the tenant-only `POST /maintenance`, which always
returned 403 — dead code that looked like a feature.

### 11.2 The corrected flow (all enforced server-side)

| Step | Endpoint | Who | Server-side guarantee |
| --- | --- | --- | --- |
| 1. Report an issue | `POST /api/v1/maintenance` (multipart, ≤5 photos) | TENANT | room must have an **ACTIVE contract** for that tenant; `landlordId` derived from the property, never from the client |
| 2. Review issues | `GET /api/v1/maintenance/my`, `GET /api/v1/maintenance/:id` | landlord of the property / the reporter | owner-scoped `where`; mismatch → 404 (no existence leak) |
| 3. Answer the report | `PATCH /api/v1/maintenance/:id/triage` | LANDLORD | `NEEDS_INFO`/`REJECTED` **require** a reason; blocked once the issue is `COMPLETED` |
| 4. Issue → staff task | `POST /api/v1/maintenance/:id/tasks` (multipart) | LANDLORD | issue **and** its property must belong to the caller; workplace (property/room/address/coords) is derived from the issue; titles/description/category/urgency prefilled; duplicate guard; issue triage set to `REVIEWED` in the same transaction |
| 5. Apply / assign | `/api/v1/maintenance-tasks/*` | STAFF / LANDLORD | unchanged from §5–§6 (KYC gate, atomic assignment, `409`) |

A tenant has no route to publish a staff task: `POST /maintenance/:id/tasks` is
`authorize('LANDLORD')`, and `POST /maintenance-tasks` was never open to tenants.

### 11.3 Schema delta **awaiting approval** (not applied)

Generated with `prisma migrate diff --from-schema-datasource --to-schema-datamodel`
(read-only). **Purely additive**: one enum, four new columns, one new table, three
indexes, two foreign keys. No `DROP`, no `ALTER COLUMN`, no `SET NOT NULL` on an
existing column without a default.

```sql
-- CreateEnum
CREATE TYPE "MaintenanceTriageStatus" AS ENUM ('PENDING', 'REVIEWED', 'NEEDS_INFO', 'REJECTED');

-- AlterTable
ALTER TABLE "maintenance_requests" ADD COLUMN     "category" "ServiceCategory",
ADD COLUMN     "triage_note" TEXT,
ADD COLUMN     "triage_status" "MaintenanceTriageStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "triage_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "maintenance_tasks" ADD COLUMN     "source_issue_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "maintenance_request_images" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_request_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_request_images_request_id_idx" ON "maintenance_request_images"("request_id");
CREATE INDEX "maintenance_requests_landlord_id_triage_status_idx" ON "maintenance_requests"("landlord_id", "triage_status");
CREATE INDEX "maintenance_tasks_source_issue_id_idx" ON "maintenance_tasks"("source_issue_id");

-- AddForeignKey
ALTER TABLE "maintenance_request_images" ADD CONSTRAINT "maintenance_request_images_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_source_issue_id_fkey" FOREIGN KEY ("source_issue_id") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Variant B:** `source_issue_id` is `NOT NULL` and the FK is `ON DELETE CASCADE`.
Consequence of `NOT NULL` on an existing table: PostgreSQL rejects
`ADD COLUMN ... NOT NULL` without a default **if the table has rows**. The
pre-flight read-only check confirmed `maintenance_tasks` held 0 rows, so the
statement applied cleanly. Had rows appeared meanwhile, `db push` would have
failed loudly with nothing lost; the fallback in that case is nullable column →
backfill from the issue → `SET NOT NULL`, inside one approved script.

Rollback is symmetric and safe (`DROP` the two FKs/indexes/table, drop the four
columns, drop the enum) because no existing column or row is rewritten.

#### Applied to Supabase DEV (approved and executed 2026-12-11)

`prisma db push` (no `--accept-data-loss`, no `--force-reset`, no prompt) →
*"Your database is now in sync with your Prisma schema. Done in 5.14s"*, client
regenerated (v6.19.3). Read-only verification afterwards:

| Check | Result |
| --- | --- |
| Target | `aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres` (same DEV project as §7) |
| Tables in `maintenance%` | 6 — `maintenance_request_images` created, the 5 existing ones intact |
| New columns | `category` nullable · `triage_note` nullable · `triage_updated_at` nullable · `triage_status` `NOT NULL DEFAULT 'PENDING'` · `source_issue_id` **`NOT NULL`, no default** |
| Enum | `MaintenanceTriageStatus` = `PENDING, REVIEWED, NEEDS_INFO, REJECTED` (in order) |
| New indexes | the 3 expected, by name |
| New FKs | both present with `confdeltype = 'c'` (CASCADE) |
| Row counts | `maintenance_requests` 0 · `maintenance_request_images` 0 · `maintenance_tasks` 0 · `maintenance_task_applications` 0 |

### 11.4 Three status axes, deliberately not merged

| Field | Values | Meaning |
| --- | --- | --- |
| `maintenance_requests.status` | `PENDING` / `IN_PROGRESS` / `COMPLETED` / `CANCELLED` | unchanged work lifecycle (Batch 1) |
| `maintenance_requests.triage_status` | `PENDING` / `REVIEWED` / `NEEDS_INFO` / `REJECTED` | did the landlord act on the **report**? |
| `maintenance_tasks.status` | `OPEN` / `ASSIGNED` / `CANCELLED` | the **marketplace job** (Batch 2) |

Reusing `status` for triage was rejected: "rejected by landlord" and "cancelled"
would be indistinguishable, and "needs more information" has no place in a work
lifecycle enum. Because step 4 only writes `triage_status`, the Batch 1 workflow
(`PATCH /:id/status`, `resolvedAt`) behaves exactly as before.

### 11.5 Duplicate prevention: one active task per issue

`POST /maintenance/:id/tasks` re-reads the issue inside
`prisma.$transaction(..., { isolationLevel: 'Serializable' })` and rejects with
`409 ISSUE_ALREADY_HAS_TASK` when a task with `source_issue_id = issue` is `OPEN`
or `ASSIGNED`. A concurrent loser hits a serialization failure (`P2034`) which is
mapped to the same 409, so double-submits cannot create two jobs.

A **partial** unique index (`WHERE status <> 'CANCELLED'`) would be the DB-level
equivalent, but this project syncs schema with `prisma db push`, which reconciles
away indexes it does not know about; a hand-made index would silently disappear on
the next sync. The Serializable transaction is therefore the guarantee, and the
`@@index([sourceIssueId])` keeps the check cheap. Re-publishing **after a cancel
is intentionally allowed** (a cancelled job means nobody was hired).

**How many tasks can one issue produce?** Many over time, but never two **active**
ones. The column is therefore a plain indexed FK, not `@unique`: a unique column
would permanently dead-end an issue after a cancellation (no way to recruit
again), while the actual rule is "one job at a time". Only a *partial* unique index
could express that, and it cannot be represented in `prisma schema` (see above),
so the Serializable transaction is the enforcement point — and the invariant is
locked by two tests (`ISSUE_ALREADY_HAS_TASK` and the `P2034` race mapping).

### 11.6 Issue photos are referenced, never re-uploaded — and never deleted by the task

`createFromIssue` copies the issue's image **URLs** into `maintenance_task_images`
so the staff sees the tenant's evidence, plus any photos the landlord uploads.
That shares the Cloudinary asset between two rows, which was only safe after
closing one hole: `maintenanceTaskService.update` replaces task images with
`deleteMany` and then calls `storageService.deleteImage` on the old URLs. It now
deletes **only assets inside its own folder** (`isTaskOwnedAsset`, i.e. URLs under
`rental-management/maintenance-tasks/`), so editing a job can never destroy the
tenant's evidence, which lives under `rental-management/maintenance-requests/`.
Failure cleanup in `createFromIssue` likewise removes only the URLs uploaded by
that request.

> 🆕 **Batch 2.1 (M2) update** — new evidence is stored as a private Cloudinary
> `public_id` (`uploadPrivateImage`, `type: authenticated`) and delivered through
> the authorized endpoint `GET /api/v1/maintenance-images/:kind/:id?token=…`;
> payloads no longer contain public URLs. Rows created above keep their public
> URL and still work through that endpoint until the operational migration is
> run. See `docs/BATCH-2.1-REMEDIATION.md` §3.

### 11.7 Decision: Variant B implemented — no direct task creation

Every marketplace task must originate from a tenant-reported issue; direct creation
is **not** kept as an exception.

| Layer | Change |
| --- | --- |
| DB | `maintenance_tasks.source_issue_id` **NOT NULL**, FK `ON DELETE CASCADE` |
| Service | `maintenanceTaskService.create` deleted; `createFromIssue` is the only writer and always sets `sourceIssueId` |
| Route | `POST /api/v1/maintenance-tasks` removed (and its controller method) |
| Validation | `maintenanceTaskCreateSchema` / `MaintenanceTaskCreateInput` deleted; the from-issue schema is the only create payload and still rejects client-supplied `propertyId`/`roomId`/`address` |
| Client | `maintenanceTasks.create` removed; the task page no longer offers creation and links to the issue review page |

Consequence accepted: a landlord cannot request staff work for a vacant property
where no tenant reported anything. If that need returns, the correct model is a
landlord-raised issue on their own property — not a task without a source, since
`source_issue_id NOT NULL` makes that unrepresentable.

### 11.8 What was deliberately NOT changed

- `PATCH /maintenance/:id/status` and `resolvedAt` semantics (Batch 1 flow intact).
- `MaintenanceStatus` enum values — no new values were injected into the old
  lifecycle.
- Tenant can never publish a staff task: `POST /maintenance/:id/tasks` is
  `authorize('LANDLORD')`, and the direct-creation route no longer exists at all.
- The `403 → /403` global client behaviour; the UI disables unavailable actions
  instead of probing the server.
- No notifications were added for step 3/4 (the tenant already sees
  `triageStatus`, `triageNote` and the linked task in `GET /maintenance/my`).

### 11.9 Verification of the correction (all run locally, no DB write)

| Check | Result |
| --- | --- |
| `prisma validate` | valid |
| `prisma generate` (local types only) | regenerated |
| `server`: `npx tsc --noEmit` | 0 errors |
| `client`: `npx tsc --noEmit` | 0 errors |
| `client`: `npx eslint` (5 touched client files) | 0 problems |
| `npx vitest run` (whole server suite) | **166 passed / 19 files** (was 151/17; +14 new, and the 3 removed direct-creation tests were replaced by 4 update-path tests including the Cloudinary-ownership guard) |
| `prisma migrate diff` (§11.3 SQL) | one `ADD COLUMN ... NOT NULL` (0-row table), one enum, one table, 3 indexes, 2 FKs — no `DROP`/`ALTER COLUMN` |
| Pre-flight (read-only) | target host = DEV pooler; `maintenance_tasks` = 0 rows; `source_issue_id` absent |
| `prisma db push` | **applied** — in sync in 5.14 s, no `--accept-data-loss`, no prompt, client regenerated |
| Post-migration introspection (read-only) | 6 tables, 5 new columns with the expected nullability/defaults, enum in order, 3 indexes, 2 FKs with `confdeltype='c'`, counts still 0 |
| Live Prisma query shapes (read-only) | **6/6** — `issueSelect`, owner-triage filter, `maintenanceRequestImage`, `sourceIssueId` duplicate lookup, prefill select, task summary with `sourceIssueId` |
| Boot smoke (`PORT=4711`, real `.env`) | server started, empty stderr, `PATCH /maintenance/:id/triage` → 401, `POST /maintenance/:id/tasks` → 401, `GET /maintenance/:id` → 401, `/maintenance/my` → 401; port released. (A 401 here only proves the router's auth runs first — the absence of `POST /maintenance-tasks` is proven by the router source, not by this probe.) |

### 11.10 Next steps for this correction

1. ~~Approve and apply the §11.3 SQL to Supabase DEV~~ — **done** (§11.3 applied block).
2. Run the §10 checklist including item 6 (needs 3 authenticated sessions; the DB
   is intentionally left empty — no seed was run).



