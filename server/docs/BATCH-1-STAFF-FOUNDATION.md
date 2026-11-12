# Batch 1 — Role & Staff Foundation (staff marketplace)

**Status: IMPLEMENTED IN SOURCE — database change NOT applied.**
Every schema statement in §4 is a proposal for explicit approval before
`prisma db push` / any migration is run against Supabase DEV. No `.env`, credential
or secret was read or printed. Nothing in this document was verified at runtime:
only source inspection, Prisma validation/generation, TypeScript compilation and
DB-free unit tests were executed (§6).

Related documents: [`AUTH-HARDENING-RUNBOOK.md`](./AUTH-HARDENING-RUNBOOK.md),
[`SEED-DATA.md`](./SEED-DATA.md).

## 1. Scope of Batch 1

| Item | Delivered | Notes |
| --- | --- | --- |
| Independent STAFF role | yes | `Role.STAFF` added (additive enum value) |
| Staff self-registration | yes | through the existing hardened `POST /auth/register` (bcrypt + OTP + transaction); no parallel auth path |
| Staff profile (name, avatar, phone, address, coordinates, description, price range, availability) | yes | `staff_profiles` + reuse of `users` for name/phone/avatar/account status |
| Structured skills | yes | `ServiceCategory` enum + `staff_skills` join table (unique per profile) |
| Landlord discovery (skill/availability filter) | yes (without distance) | distance sorting is Batch 2 (needs property coordinates + Haversine) |
| AGENT role removal | partially | every behavioural reference removed (§5); the enum value itself is a data-losing change and is gated (§5.3) |

Out of scope for this batch (untouched): task/marketplace lifecycle, negotiation,
completion evidence, reviews, disputes, chat, notifications, invoice numerics.

## 2. Files changed

### Server (`server/`)

| File | Change |
| --- | --- |
| `prisma/schema.prisma` | `Role.STAFF`; new `ServiceCategory` enum; new `StaffProfile`, `StaffSkill` models; `User.staffProfile` relation; `AGENT` marked deprecated |
| `src/validations/staffProfile.validation.ts` | **new** — zod schemas for profile upsert, availability, browse query |
| `src/validations/staffProfile.validation.test.ts` | **new** — 8 unit tests |
| `src/services/staffProfile.service.ts` | **new** — own profile upsert (transactional skills), availability, public profile, browse |
| `src/services/staffProfile.service.test.ts` | **new** — 8 unit tests |
| `src/controllers/staffProfile.controller.ts` | **new** |
| `src/routes/staffProfile.route.ts` | **new** — mounted at `/api/v1/staff-marketplace` |
| `src/app.ts` | mount new router |
| `src/validations/auth.validation.ts` | registration role enum: `AGENT` → `STAFF` |
| `src/routes/user.route.ts` | allow `STAFF` (self profile & KYC), drop `AGENT` |
| `src/routes/report.route.ts` | allow `STAFF`, drop `AGENT` |
| `src/routes/contract.route.ts` | drop `AGENT` from `/my` |
| `src/services/appointment.service.ts` | drop `AGENT` branch |
| `src/services/contract.service.ts` | drop `AGENT` branch |
| `src/services/review.service.ts` | drop agent-based review relations |
| `src/services/staff.service.ts` | refuse to turn a marketplace STAFF into a landlord's employee (independence guard) |
| `src/config/swagger.ts` | role enum `AGENT` → `STAFF` |
| `src/services/kycGate.service.ts` | **new** — reusable KYC gate (`kycStateOf`, `isKycApproved`, `assertKycApproved`, `loadKycState`); no new table |
| `src/services/kycGate.service.test.ts` | **new** — 8 unit tests (fail-closed + error code + relation mapping) |
| `src/services/staffProfile.service.ts` | KYC gate on `isAvailable = true` (profile upsert **and** availability endpoint), `kycStatus` in own payload, public reads require approved KYC |
| `src/services/admin.service.ts` | KYC queue returns `user.role` and accepts an optional `role` filter (invalid values ignored, not 500) |
| `src/controllers/admin.controller.ts` | pass `role` query through to the shared KYC queue |

### Client (`client/`)

| File | Change |
| --- | --- |
| `types/models.ts` | `Role` union `AGENT` → `STAFF`; new `ServiceCategory`, `StaffProfile`, `StaffProfilePayload`, `StaffBrowseQuery` |
| `lib/api.ts` | new `staffMarketplace` namespace (5 endpoints) |
| `lib/labels.ts` | `STAFF` label, `translateServiceCategory`, `SERVICE_CATEGORY_OPTIONS` |
| `lib/utils.ts` | `getRoleLabel` `AGENT` → `STAFF` |
| `components/tenant/public-navbar.tsx` | AGENT workspace link → STAFF `/staff/profile` |
| `app/(auth)/register/page.tsx` | third role tab (STAFF) + independence note |
| `app/staff/layout.tsx` | **new** — minimal staff workspace shell; nav entry for `/staff/kyc` |
| `app/staff/profile/page.tsx` | **new** — skills/description/location/price/availability editor; KYC status banner, availability blocked until KYC is approved |
| `app/admin/users/page.tsx`, `app/admin/roles/page.tsx`, `app/admin/dashboard/page.tsx` | `AGENT` label/filter/counter → `STAFF` |
| `components/kyc/kyc-submission-form.tsx` | **new** — shared CCCD submission form (extracted from the landlord page, one implementation for both roles) |
| `app/staff/kyc/page.tsx` | **new** — staff KYC submission/status page (reuses the shared form) |
| `app/landlord/kyc/page.tsx` | refactored to render the shared form; same API, same fields, same messages (behaviour unchanged) |
| `app/admin/landlords/kyc/page.tsx` | shows submitter role badge + `Tất cả / Chủ trọ / Thợ` queue filter |
| `types/models.ts` | `KycState` (`NONE` + `KycStatus`), `KycRole`, `StaffProfile.kycStatus` |
| `lib/api.ts` | `adminGovernance.getKyc(status, role)` role filter |
| `lib/labels.ts` | `translateKycState` |

Pre-existing dirty files from the H-05 work were left untouched (they merely carry
the new lines listed above where the same file also held H-05 edits).

## 3. API surface and authorization

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | public | `role: 'TENANT' \| 'LANDLORD' \| 'STAFF'`; existing OTP/bcrypt/transaction flow unchanged |
| `GET` | `/api/v1/staff-marketplace/me` | `STAFF` | own profile; `data: null` when not created yet |
| `PUT` | `/api/v1/staff-marketplace/me` | `STAFF` | upsert profile + replace skills in one transaction |
| `PATCH` | `/api/v1/staff-marketplace/me/availability` | `STAFF` | 404 if profile does not exist |
| `GET` | `/api/v1/staff-marketplace` | `LANDLORD`, `ADMIN` | paginated browse, filters `category`, `isAvailable`, `search` |
| `GET` | `/api/v1/staff-marketplace/:userId` | any authenticated | public projection only |
| `GET` | `/api/v1/users/kyc` | `TENANT`, `LANDLORD`, `STAFF`, `ADMIN` | **existing** endpoint, unchanged: my own KYC submission |
| `POST` | `/api/v1/users/kyc` | same | **existing** endpoint, unchanged: upsert my CCCD submission (private Cloudinary) |
| `GET` | `/api/v1/admin/kyc?status=&role=` | `ADMIN` | **existing** endpoint, extended: shared queue now returns `user.role` and accepts an optional `role` filter |
| `PATCH` | `/api/v1/admin/kyc/:id/status` | `ADMIN` | **existing** endpoint, unchanged: approve/reject any submission |

Design notes that matter for later batches:

- **Namespace separation.** `/api/v1/staff` (unchanged) manages `StaffMembership`
  — employees a landlord grants property permissions to. The marketplace lives at
  `/api/v1/staff-marketplace` so the two concepts can never be confused by an
  authorization check.
- **Ownership derived server-side.** Every own-profile query keys on
  `req.user.id`; there is no id in the path for write operations, so no IDOR
  surface exists for "edit my profile".
- **Public projection excludes** `email`, `phone` and `latitude`/`longitude`.
  Coordinates are needed server-side (Batch 2 distance) but publishing a
  provider's home coordinates to every logged-in user would leak personal data.
- **Every read filters `user.role = 'STAFF' AND user.isActive = true`**, so the
  endpoints cannot be used to enumerate other accounts (the test at
  `staffProfile.service.test.ts` asserts the exact `where` shape).
- **Skills are structured.** The only accepted values are the eight
  `ServiceCategory` values; duplicates are de-duplicated before insert so the
  composite primary key `(staff_profile_id, category)` can never collide.
- **Account status is not duplicated.** Availability (`staff_profiles.is_available`)
  answers "accepting work?"; suspension stays on `users.is_active`, which
  `authenticate` already enforces on every request.
- **Independence guard.** `staffService.invite` rejects a `STAFF` account, so a
  landlord cannot convert a marketplace provider into a permission-carrying
  employee (requirement §2.2).
- **Staff KYC reuses the landlord pipeline.** `POST/GET /users/kyc` and the two
  admin endpoints above already existed; STAFF writes into the same
  `kyc_submissions` row shape (`user_id @unique`). Nothing about KYC was
  duplicated — details, including the one authorization assumption that had to be
  fixed, are in §8.

### Numeric/geo input handling

`staffProfile.validation.ts` deliberately does **not** use bare
`z.coerce.number()` for optional fields, because `Number('') === 0` silently
turns an empty input into a real zero (the same failure family as the reported
invoice bug):

- `''`/`null` → `null` = "clear the stored value";
- absent → field untouched (partial update);
- `'abc'`, `'1.500.000'` → 400 validation error, never `0`/`NaN`;
- latitude/longitude must be supplied as a pair; range-checked (−90..90 / −180..180);
- `priceMax >= priceMin` enforced.

The client mirrors this in `app/staff/profile/page.tsx` (`parseNumberField`) and
explicitly refuses unparseable input instead of sending `NaN`.

## 4. Database gate — pending approval

`prisma validate` and `prisma generate` were run (both exit 0). **No push was
performed.** The verified delta below was produced with

```
prisma migrate diff --from-schema-datamodel <HEAD schema> \
                    --to-schema-datamodel prisma/schema.prisma --script
```

and contains **only additive statements** (no `DROP`), i.e. applying it cannot
destroy rows. Statements marked 🆕 come from Batch 1; the rest are the
pre-existing, not-yet-pushed H-05 columns from earlier work.

**Staff KYC adds nothing to this delta.** `kyc_submissions` (table, `KycStatus`
enum, private document columns, `user_id` unique, reviewer FK) already existed and
is role-neutral, so no new column, table or enum is proposed for KYC. A
`staff_profiles.kyc_status` column was deliberately **not** added: it would be a
second source of truth that can disagree with `kyc_submissions.status`.

```sql
-- 🆕 CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('ELECTRICAL', 'PLUMBING', 'WATER_LEAK', 'FURNITURE',
  'AIR_CONDITIONER', 'PAINTING', 'CLEANING', 'GENERAL_MAINTENANCE');

-- 🆕 AlterEnum (additive: existing AGENT rows stay valid)
ALTER TYPE "Role" ADD VALUE 'STAFF';

-- (pre-existing H-05) CreateEnum OtpPurpose, users.auth_version/password_proven_*,
-- email_verification_codes.attempts/max_attempts/purpose/hmac_version

-- 🆕 CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "description" TEXT,
    "service_address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "price_min" DECIMAL(12,2),
    "price_max" DECIMAL(12,2),
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- 🆕 CreateTable
CREATE TABLE "staff_skills" (
    "staff_profile_id" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_skills_pkey" PRIMARY KEY ("staff_profile_id","category")
);

-- 🆕 CreateIndex
CREATE UNIQUE INDEX "staff_profiles_user_id_key" ON "staff_profiles"("user_id");
CREATE INDEX "staff_profiles_is_available_idx" ON "staff_profiles"("is_available");
CREATE INDEX "staff_skills_category_idx" ON "staff_skills"("category");

-- 🆕 AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_skills" ADD CONSTRAINT "staff_skills_staff_profile_id_fkey"
  FOREIGN KEY ("staff_profile_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Data-migration implications: **none**. No existing table is altered, no column is
dropped or retyped, no row is rewritten. Recommended execution (after approval):
`npm run db:sync` in `server/` (it is `prisma db push --skip-generate`; the client
is already generated).

## 5. AGENT role removal

### 5.1 Inventory (state before this batch)

| Location | Reference |
| --- | --- |
| `prisma/schema.prisma:19` | `Role.AGENT` enum value |
| `src/validations/auth.validation.ts:13` | self-registration allowed `AGENT` |
| `src/routes/user.route.ts:10` | `authorize(..., 'AGENT')` |
| `src/routes/report.route.ts:8` | `authorize(..., 'AGENT')` |
| `src/routes/contract.route.ts:15` | `authorize(..., 'AGENT')` |
| `src/services/appointment.service.ts:91` | `whereClause = { agentId: userId }` |
| `src/services/contract.service.ts:84` | `whereClause.agentId = userId` |
| `src/services/review.service.ts:42-43` | agent↔tenant review relations |
| `src/config/swagger.ts:56` | OpenAPI role enum |
| `client/types/models.ts:10` | `Role` union |
| `client/lib/labels.ts:6`, `client/lib/utils.ts:166` | Vietnamese labels |
| `client/components/tenant/public-navbar.tsx:196` | AGENT workspace link |
| `client/app/admin/{dashboard,roles,users}` | label maps, filter chips, counters |
| `prisma/seed.ts` | **no** AGENT fixture (verified) |

### 5.2 Removed in this batch

All references above are gone except the enum value (§5.3). Consequences, by
design:

- No route accepts `AGENT` any more, so an existing AGENT account is **frozen**
  (every authorized endpoint answers 403). Nothing was converted, deleted or
  re-roled.
- No write path sets `appointments.agent_id` / `contracts.agent_id` and nothing
  queries them; `contracts`/`commissions` rows already in the DB are untouched.
- Registration can no longer mint AGENT accounts.

### 5.3 Remaining: the enum value (needs an explicit data decision)

Removing `AGENT` from `enum Role` is **not** a code-only change: PostgreSQL must
recreate the type, and any row with `users.role = 'AGENT'` blocks it. Prisma
`db push` will refuse (or, worse, propose data loss). It is therefore deliberately
left in place until the data policy is chosen.

Pre-check (run first, read-only):

```sql
SELECT count(*) AS agent_users FROM "users" WHERE "role" = 'AGENT';
SELECT count(*) AS agent_appointments FROM "appointments" WHERE "agent_id" IS NOT NULL;
SELECT count(*) AS agent_contracts FROM "contracts" WHERE "agent_id" IS NOT NULL;
SELECT count(*) AS commissions FROM "commissions";
```

Options (choose one — **no option is executed by this change**):

| # | Policy | SQL | Trade-off |
| --- | --- | --- | --- |
| A (recommended) | Freeze + downgrade: AGENT accounts become inactive `TENANT`, admin reviews each one before reactivation | `UPDATE "users" SET "is_active" = false, "role" = 'TENANT' WHERE "role" = 'AGENT';` | no data deleted; historical contracts/commissions keep their FK; the user must be reviewed by an admin |
| B | Promote brokers into the new marketplace | `UPDATE "users" SET "role" = 'STAFF' WHERE "role" = 'AGENT';` | **explicitly not to be done implicitly**; would grant marketplace presence without the STAFF profile/KYC review |
| C | Delete AGENT accounts | cascading deletes | rejected: destroys messages, reviews, contracts, invoices history |

When an option is approved, the enum removal is a two-line schema patch:

```diff
   TENANT
   STAFF
-  // ⚠️ DEPRECATED ... (comment block)
-  AGENT // Người dẫn đi xem / Môi giới / Cộng tác viên
 }
```

followed by, in this order: the chosen `UPDATE` → `npx prisma validate` →
`npx prisma migrate diff` (verify the ALTER TYPE) → `npm run db:sync` →
`npx tsc --noEmit`.

Legacy columns (`appointments.agent_id`, `contracts.agent_id`, the `commissions`
table, and the mirrored `agentId`/`agent` fields in `client/types/models.ts`) are
kept: dropping them is a separate data-retention decision, and dropping a column
is not required to retire the role.

## 6. Validation evidence (static only)

| Command | Result |
| --- | --- |
| `npx prisma validate` (server) | exit 0 — "The schema at prisma/schema.prisma is valid 🚀" |
| `npx prisma generate` (server) | exit 0 — client regenerated with `StaffProfile`, `StaffSkill`, `ServiceCategory`, `Role.STAFF` |
| `npx tsc --noEmit` (server) | exit 0 |
| `npx tsc --noEmit` (client) | exit 0 |
| `npx vitest run src/services/staffProfile.service.test.ts src/validations/staffProfile.validation.test.ts` | exit 0 — **16 tests passed (2 files)** |
| `npx vitest run` (full server suite, after the KYC work) | exit 0 — **98 tests passed (13 files)** |
| `npx vitest run src/services/staffProfile.service.test.ts src/services/kycGate.service.test.ts src/validations/staffProfile.validation.test.ts src/services/admin.users.test.ts` | exit 0 — **43 tests passed (4 files)** |
| `npx eslint` on every changed client file | exit 0 (no warnings/errors) |
| `prisma migrate diff` (schema→schema) | exit 0 — delta in §4 (additive only) |

Not performed: `db push`, migrations, runtime/UAT, seeding, any request against a
live server, and any Supabase access. Statements about behaviour above are derived
from source inspection + unit tests with a mocked Prisma client, not from a running
system.

## 7. Next steps

1. **Approval gate:** approve §4 (additive) and pick an option in §5.3.
2. **Batch 2 (task marketplace):** needs new tables (`maintenance_tasks`, task
   images, applications/assignments, negotiation history) plus the Haversine
   ordering for `GET /staff-marketplace`. Distance ordering must skip staff with
   `latitude`/`longitude` = NULL explicitly (never treat missing as `(0,0)`) and
   must fall back to a deterministic secondary order (`updatedAt desc, id asc`).
3. Runtime checks owed to the release gate once a DB is approved: register a STAFF
   account end-to-end (OTP → login → profile save → availability toggle), confirm a
   LANDLORD can browse and that a TENANT cannot, and confirm an old AGENT token now
   receives 403 everywhere.
4. **Batch 2 must call the KYC gate at every job entry point**, not only where Batch 1
   already does (availability + public visibility). Concretely: applying for a task,
   accepting an assignment and marking work complete each call
   `assertKycApproved(await loadKycState(userId, tx), '<action>')` **inside** the same
   transaction as the write, so a re-submitted (now `PENDING`) KYC cannot be raced
   against an acceptance.
5. KYC runtime checks to add to the release gate: submit as STAFF → admin rejects with
   a reason → staff sees the reason and can resubmit → admin approves → only then can
   the staff turn availability on; and a LANDLORD submission still lands in the same
   admin queue (no regression).

## 8. Staff KYC — reuse audit of the existing landlord workflow

### 8.1 What already existed (inspected, reused, not rewritten)

| Layer | Existing artefact | Reused as-is |
| --- | --- | --- |
| Data | `KycSubmission` → `kyc_submissions`; `user_id` **unique**; `KycStatus` (`PENDING/APPROVED/REJECTED`); `front_id_url`/`back_id_url` (private public_ids); `rejection_reason`; `reviewed_by_id`/`reviewed_at` | yes — one row per user, keyed by `userId`. No `role` column is needed: role comes from `users.role`, so there is exactly one status per account |
| Storage | `storageService.uploadPrivateImage` (Cloudinary `type: authenticated`, folder `rental-management/kyc`), `getPrivateImageUrl` (signed), delete-on-replace | yes |
| Upload/validation | `multer` memory storage + `validateUploadedImages` (magic-byte check) + `kycSubmissionSchema` (`idNumber` 9–20, `permanentAddress` 5–300) | yes — see §8.3 |
| Submission API | `POST /api/v1/users/kyc`, `GET /api/v1/users/kyc` | yes |
| Review API | `GET /api/v1/admin/kyc`, `PATCH /api/v1/admin/kyc/:id/status` | yes, extended additively |
| Review UI | `client/app/admin/landlords/kyc/page.tsx` | yes, extended (role badge + `Tất cả/Chủ trọ/Thợ` filter) |
| Submission UI | `client/app/landlord/kyc/page.tsx` | logic **extracted** into `components/kyc/kyc-submission-form.tsx`; the landlord page renders it with unchanged copy and behaviour |

### 8.2 Newly implemented

| Item | Why it was necessary |
| --- | --- |
| `src/services/kycGate.service.ts` (`kycStateOf`, `isKycApproved`, `assertKycApproved`, `loadKycState`) | the existing workflow had **no gate at all** — nothing stopped an unverified account from acting. Fail-closed helper, `403` + machine-readable `STAFF_KYC_REQUIRED` |
| Gate on **both** `PUT /staff-marketplace/me` and `PATCH /staff-marketplace/me/availability` | `isAvailable` can be sent in both payloads; gating only the availability endpoint would let `isAvailable: true` through the profile upsert |
| `kycStatus` in the staff own-profile payload (`NONE` = never submitted) | computed from the nested `user.kycSubmission.status` in the same query — no extra round trip |
| Browse + public profile require `kycSubmission.status = APPROVED` | a staff who cannot accept work must not appear as hireable |
| `admin.service.getKycSubmissions(status, role)` and `user.role` in the projection | the queue was landlord-shaped: admins could not tell a staff submission from a landlord one. Unknown filter values are ignored, never a 500 |
| `app/staff/kyc/page.tsx`, KYC banner on `/staff/profile`, nav entry in `app/staff/layout.tsx` | staff had no reachable KYC screen |

### 8.3 Role-specific assumptions found, and the verdict

| Assumption | Verdict |
| --- | --- |
| `KycSubmission` carries landlord-only fields (business licence, ownership papers) | **false** — every column is identity-generic; nothing had to be duplicated |
| `kycSubmissionSchema` encodes landlord/business rules | **false** — 9–20 char ID + 5–300 char address accept CMND (9), CCCD (12) and passport. Left unchanged so landlord validation does not silently tighten |
| `/users/kyc` is landlord-only | **partly true** — the route's `authorize` list did not include `STAFF`; fixed with the AGENT→STAFF swap. `TENANT`/`ADMIN` access was pre-existing and is untouched |
| The admin queue is landlord-shaped | **true** — no `role` in the projection; fixed additively (§8.2) |
| A `staff_profiles.kyc_status` mirror column | **rejected** — a duplicate status that can desync from `kyc_submissions.status` |

### 8.4 Deliberate limits

- KYC gating of *applying for / accepting / performing* tasks has no server target
  yet: task applications and assignments are Batch 2 tables. The gate is therefore
  applied to the two entry points Batch 1 owns (availability + public visibility) and
  exported for Batch 2 (§7 item 4).
- `updateKyc` still lets an admin approve a submission from any role (including
  `TENANT`/`ADMIN` rows created through the legacy endpoint). That is existing
  behaviour; restricting it would change landlord-era data handling.
- KYC does **not** gate profile editing: a staff must be able to build a profile
  before submitting CCCD, otherwise onboarding deadlocks.
- Existing staff profiles created before this change are **not** auto-hidden: browse
  now filters them out until KYC is approved, which is the intended effect, but no
  data was rewritten.

