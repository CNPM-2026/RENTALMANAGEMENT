# BATCH 2.1 — Security & Concurrency Remediation (M1, M2, M3, M4, L3, L4, L5)

> **Lưu ý đường dẫn test (cập nhật Batch 4):** test đã chuyển từ `server/src/**` sang `server/tests/**`
> (giữ nguyên tên file). Các lệnh `npx vitest run src/...` dưới đây là bản ghi lịch sử.

Targeted follow-up on the Batch 2 review (**PASS WITH FINDINGS**). Batch 2
functionality is unchanged; nothing here starts Batch 3 (negotiation/completion).
No schema change, no migration, no `db push`.

Environment: Supabase **DEV** only. Production not accessed.

---

## 0. Status summary

| ID | Finding | Status |
| --- | --- | --- |
| **M1** | Task content editable after assignment (unconditional update) | **Fixed** |
| **M2** | Tenant maintenance evidence served as public Cloudinary URLs | **Partially fixed** — new uploads + all delivery paths are private; **existing public objects require the operational migration in §3.4** |
| **M3** | One-active-task-per-issue relies on Serializable + app-level predicate | **Verified & retained** (evidence in §4); partial unique index **requires DB approval** (not applied) |
| **M4** | Landlord triage: unguarded concurrent writes, incomplete transition validation | **Fixed** |
| **L3** | Issues convertible from inappropriate states | **Fixed** |
| **L4** | Application can be inserted after assignment | **Fixed** |
| **L5** | Assignment does not re-check availability/skills | **Fixed** |

No item is left "Not fixed" in code. `Requires operational migration`: existing
public Cloudinary objects (§3.4). `Requires database approval`: proposed partial
unique index (§4.3).

---

## 1. M1 — Task editing after assignment

**Root cause.** `maintenanceTaskService.update` read `status` outside the
transaction, then ran `tx.maintenanceTask.update({ where: { id } })`
unconditionally. An `accept` committing between the read and the write left a
task whose content/skills/images had been changed after the staff member took it.

**Files.** `server/src/services/maintenanceTask.service.ts` (`update`, ~L447-L562).

**Correction.** First statement inside the transaction is a conditional claim:

```ts
const claimed = await tx.maintenanceTask.updateMany({
  where: { id: taskId, landlordId, status: 'OPEN' },
  data: { status: 'OPEN' },          // re-assert, not a transition
});
if (claimed.count !== 1) throw new AppError(..., 409, 'TASK_NOT_OPEN');
```

* `UPDATE ... WHERE status = 'OPEN'` takes the row lock for the rest of the
  transaction, so `accept`/`cancel` (which use the same predicate) must wait.
* If `accept`/`cancel` committed first, the claim matches 0 rows → **409
  `TASK_NOT_OPEN`**. Skills, images and content are written only after a
  successful claim, so a lost race cannot leave a partial edit.
* The pre-check read is kept for a fast, friendly 404/409 but is **not** the
  authorization decision.
* `isTaskOwnedAsset` guard preserved: tenant evidence (`maintenance-requests`
  folder) is never deleted by a task edit.

**Invariants now enforced.** Exactly one winner between edit and assign/cancel;
no content change after assignment; tenant evidence never mutated or deleted.

---

## 2. M4 — Landlord triage transitions

**Root cause.** `maintenanceService.triage` read the issue and then ran an
unconditional `update`. Two concurrent PATCHes overwrote each other, and a
"reviewed" write could erase a rejection reason; `NEEDS_INFO`/`COMPLETED` were
not considered at all.

**Files.** `server/src/services/maintenance.service.ts` (`triage`, ~L196-L295;
tables `TRIAGE_TRANSITIONS`, `TERMINAL_LIFECYCLE_STATUSES` at ~L97-L125).

### 2.1 Transition table (documented source evidence)

`MaintenanceTriageStatus` in `prisma/schema.prisma` L96-L106 defines two
independent axes; `maintenanceTriageSchema`
(`validations/resource.validation.ts` L169-L182) makes `triageNote` **mandatory**
for `NEEDS_INFO`/`REJECTED`; the landlord UI
(`client/app/landlord/maintenance/page.tsx` L368-L400) exposes exactly three
decisions (Đã xem xét / Cần bổ sung / Từ chối).

| From \ To | `REVIEWED` | `NEEDS_INFO` | `REJECTED` | `PENDING` |
| --- | --- | --- | --- | --- |
| `PENDING` | ✅ | ✅ | ✅ | ⛔ same-state only |
| `REVIEWED` | ⛔ same-state only | ✅ | ✅ | ⛔ |
| `NEEDS_INFO` | ✅ | ✅ (note update) | ✅ | ⛔ |
| `REJECTED` | ✅ | ✅ (new note required) | ✅ (note update) | ⛔ |

* **No path back to `PENDING`** — "not yet reviewed" cannot be the result of an
  action, and allowing it would erase the triage trail.
* Re-sending the *current* status is treated as an **idempotent note update**,
  not a transition (the UI re-sends the current value when the landlord clicks
  the same button again).
* `REJECTED → NEEDS_INFO/REVIEWED` is an explicit decision change; both targets
  are audited and `NEEDS_INFO` requires a fresh reason.
* Terminal lifecycle `COMPLETED` and `CANCELLED` reject any triage:
  `ISSUE_ALREADY_COMPLETED` / `ISSUE_ALREADY_CANCELLED` (409).

### 2.2 Atomic, guarded write

```ts
const written = await prisma.maintenanceRequest.updateMany({
  where: { id, landlordId, triageStatus: item.triageStatus, status: item.status },
  data: { triageStatus, triageNote: nextNote, triageUpdatedAt: new Date() },
});
if (written.count !== 1) throw new AppError(..., 409, 'TRIAGE_STATE_CONFLICT');
```

* Compare-and-set on the **expected** triage status *and* the lifecycle status
  read in the same request: a concurrent writer makes `count = 0` → 409, no
  write, no audit.
* `triageStatus`, `triageNote`, `triageUpdatedAt` change in **one** UPDATE, so
  "reviewed" can never coexist with a stale rejection reason.
* Switching to `REVIEWED` clears the note (`triageNote → null`). The superseded
  reason is preserved in `audit_logs` (`TRIAGE_MAINTENANCE_REQUEST` with
  `from`/`to`/`previousNote`), because the data model keeps only one note column.
* Role/ownership checks unchanged (`findFirst({ id, landlordId })`, 404 on
  mismatch).

---

## 3. M2 — Tenant evidence images

**Root cause.** `maintenance_request_images.image_url` /
`maintenance_task_images.image_url` stored the Cloudinary **public** delivery
URL (`storageService.uploadImage`, `type: upload`). Anyone holding the URL could
read photos of the inside of a tenant's home; the URL was also exposed through
`taskSummarySelect` (marketplace list) and `GET /maintenance-tasks/:id`, which
requires no role.

### 3.1 Private storage (new uploads)

* `maintenance.service.ts` / `maintenanceTask.service.ts` now call
  **`storageService.uploadPrivateImage`** → Cloudinary `type: 'authenticated'`
  (same infrastructure as KYC). The stored value is the `public_id`, **not** a URL.
* Cleanup on failure uses `deleteImage(asset, 'authenticated')`; `isTaskOwnedAsset`
  matches the folder prefix so it works for both `public_id`s and legacy URLs.
* File validation is unchanged and still enforced on every upload route:
  `multer` memory storage, MIME allow-list, 5 MB/file limit (`config/multer.ts`)
  and `validateUploadedImages` magic-byte sniffing (JPEG/PNG/WebP).
* Asset identifiers are Cloudinary-generated `public_id`s (random, unguessable)
  and the DB row id is a UUID — never derived from the client filename.
* Tenant issue evidence stays in its own table (`maintenance_request_images`)
  with its own retention rule and can only be deleted with the issue, never by a
  task edit.

### 3.2 Authorized delivery

New endpoint: **`GET /api/v1/maintenance-images/:kind/:id?token=...`**
(`routes/maintenanceImage.route.ts`, `controllers/maintenanceImage.controller.ts`,
`services/maintenanceEvidence.service.ts`).

* API payloads never contain the real asset reference. `images[].imageUrl` is a
  **relative path** `/api/v1/maintenance-images/<kind>/<id>?token=…`.
* The token is `HMAC-SHA256(JWT_SECRET)` over `{kind, imageId, viewer, role, exp}`
  (base64url, 10-minute TTL, `timingSafeEqual` comparison). It is **not** an
  authorization: on every fetch the server re-reads the business relationship and
  re-checks KYC (`loadAuthorizedEvidence`).
* The server fetches the bytes itself with a Cloudinary **signed URL that carries
  `expires_at`** (10 min) and streams them. The Cloudinary signature never
  reaches the browser. Only `https://res.cloudinary.com` may be fetched (SSRF
  guard); `/uploads/**` and any other host → 404.
* Signed URLs/tokens are never logged: morgan skips
  `/api/v1/maintenance-images`, and the route has its own rate limiter mounted
  before `apiLimiter` so a photo gallery does not consume the general API budget.
* Responses are `Cache-Control: private, max-age=600`, `Referrer-Policy:
  no-referrer`, `X-Content-Type-Options: nosniff`,
  `Cross-Origin-Resource-Policy: cross-origin`.
* Fail-closed ordering: bad/expired token → **403 `EVIDENCE_TOKEN_INVALID`**
  (before any DB read); unknown image → **404**; authenticated token without a
  relationship → **403 `EVIDENCE_FORBIDDEN`**.

#### Access matrix (enforced twice: at mint time and at fetch time)

| Asset | Tenant (reporter) | Landlord (issue/task owner) | Staff (assigned) | Staff (applied) | Staff (KYC approved, task OPEN) | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Issue evidence | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Task evidence | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

* Staff marketplace usability is preserved: a KYC-approved staff member **can**
  see the evidence of an OPEN task (needed to decide whether to apply). Without
  KYC the images are not delivered (`isKycApproved` re-read at fetch time), so
  revoking KYC immediately revokes photo access.
* Cross-property/IDOR access is denied by the relationship check, not by URL
  secrecy: a valid token for a different tenant/landlord/property is rejected.

#### Projections changed

| Surface | Before | After |
| --- | --- | --- |
| `GET /maintenance-tasks` (browse) | public `imageUrl` per task | **no image URLs**, `imageCount` only |
| `GET /maintenance-tasks/applications/mine` | `taskSummarySelect` with URLs | **no image URLs** (`taskSummarySelect` no longer selects `imageUrl`) |
| `GET /maintenance-tasks/:id` | URLs for any authenticated user | tokenized URLs only for owner/assignee/applicant/admin/KYC-approved staff; `images: []` otherwise |
| `/maintenance-tasks/mine`, `PATCH /:id`, `POST /:id/cancel`, `POST /:id/applications/:aid/accept` | public URLs | tokenized URLs for the landlord |
| `POST/GET/PATCH /maintenance*` (issues) | public URLs | tokenized URLs for the tenant/landlord scope of the request |
| `createFromIssue` (issue → task) | public URLs | tokenized URLs for the landlord |

Client: `client/lib/api.ts` `resolveMediaUrl()` now resolves `/api/v1/…`
paths against the API origin (all three maintenance pages already call it), so no
page changes were required.

### 3.3 Legacy rows

Legacy rows keep their public URL string. The delivery path still works
(server-side fetch, authorization enforced, host allow-listed), so **no evidence
reference is broken** — but the underlying Cloudinary objects remain publicly
readable.

### 3.4 Existing public assets — operational migration (NOT executed)

> **Superseded by Batch 2.2.** A runnable, resumable migration tool now exists
> (`server/scripts/maintenance-evidence-migration.js`) and was executed against
> DEV; see `docs/BATCH-2.2-REMEDIATION.md` §2. Two corrections to the procedure
> described below were found empirically in that batch:
>
> 1. Step 1 (`uploader.explicit(public_id, { type: 'authenticated' })`) **fails
>    with HTTP 404** on these assets — Cloudinary cannot re-register an existing
>    public image as `authenticated` in place. The working path is
>    **copy-bytes** (upload the downloaded bytes as a new `authenticated` asset
>    under the same `public_id`), which the script does automatically, then
>    verifies the SHA-256 byte-for-byte.
> 2. Step 4 (`destroy`) returns `ok` but public delivery keeps returning `200`
>    until Cloudinary's CDN is invalidated — the script polls the public URL
>    (4 attempts, 5 s apart) before reporting success.
>
> The procedure below is kept as the original review record.

> This is the residual part of M2. It needs Cloudinary + DB write access that this
> change was not allowed to use, so it is documented instead of claimed as done.

Inventory rule (guaranteed by the old code path): every pre-2.1 `image_url`
contains `://` and matches `https://res.cloudinary.com/<cloud>/image/upload/…`.
Batch 2 delivery recorded `maintenance_requests` = 0 and
`maintenance_request_images` = 0 rows (`docs/BATCH-2-TASK-MARKETPLACE.md` §10.5);
the current DEV count must be produced with the read-only query below (not run
here — DB access is out of scope for this remediation).

```sql
-- READ ONLY: legacy public maintenance evidence still in the database.
SELECT 'issue' AS kind, count(*) FROM maintenance_request_images WHERE image_url LIKE '%://%'
UNION ALL
SELECT 'task', count(*) FROM maintenance_task_images WHERE image_url LIKE '%://%';
```

Per-row migration procedure (verify before deleting the old copy):

1. Re-register the existing object as authenticated without re-uploading bytes:
   `uploader.explicit(public_id, { type: 'authenticated', overwrite: false })`.
2. Verify the authenticated delivery URL returns the same bytes/checksum.
3. Update the row **only after** step 2:
   `UPDATE maintenance_task_images SET image_url = '<public_id>' WHERE id = '<row>';`
   (same for `maintenance_request_images`). A `public_id` has no `://`, so
   `storageService.isPrivateRef` classifies it as private automatically and
   `getPrivateImageUrl` starts signing it.
4. Delete the **old public** asset
   (`uploader.destroy(public_id, { type: 'upload' })`) only after the DB row
   points at the authenticated copy.
5. Keep the row id unchanged: tokens are minted per row id, so tenant history and
   evidence links stay intact.

Do **not** bulk-delete first: until step 3 completes, the public object is the
only copy.

---

## 4. M3 — One-active-task-per-issue (assessment, code retained)

### 4.1 What the code does today

`createFromIssue` (`maintenanceTask.service.ts` L363-L435) runs
`prisma.$transaction(fn, { isolationLevel: 'Serializable' })` and inside it:

1. `findFirst({ sourceIssueId, status: { in: ['OPEN','ASSIGNED'] } })` → 409 if a
   live task exists;
2. `create` the task;
3. conditional triage write;
4. `catch` maps Prisma `P2034` (serialization failure / deadlock) to
   **409 `ISSUE_ALREADY_HAS_TASK`**.

### 4.2 Verdict: sufficient, retained

* Prisma 6 **does** request the isolation level: with a callback it issues
  `BEGIN` followed by `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` on the
  dedicated connection the interactive transaction holds for its whole lifetime.
  The option is not silently dropped for pooled URLs (`?pgbouncer=true` only
  changes prepared-statement handling; transaction-scoped `BEGIN`/`SET` are
  preserved by Supabase's transaction pooler because the backend connection is
  pinned to the transaction).
* Under PostgreSQL SSI, two concurrent conversions that both read "no live task"
  and both insert cause a **serialization failure** for one of them at commit;
  the loser sees `P2034` and returns 409. Two successful commits are therefore not
  possible, i.e. "at most one active task per issue" holds.
* `P2034` mapping is correct and already covered by
  `maintenanceTask.fromIssue.test.ts` ("thua cuộc đua Serializable (P2034)…").
* A retry is **not** appropriate here: the conflict means the other request
  already created the task, so retrying would produce a duplicate or a pointless
  409. Returning 409 with a reload hint is the correct behaviour.

### 4.3 Proposed hardening — requires DB approval (not applied)

> **Batch 2.2 status:** the preflight duplicate check ran clean on DEV (0 duplicate
> active tasks, 0 rows at all) and the index SQL is frozen in
> `prisma/sql/maintenance_tasks_one_active_per_issue.sql` + applied by
> `scripts/apply-maintenance-task-index.js`. It is **not applied yet** — it awaits
> explicit owner approval (`npm run db:index:one-active-task`). See
> `docs/BATCH-2.2-REMEDIATION.md` §3. Note the shipped statement uses plain
> `CREATE UNIQUE INDEX IF NOT EXISTS` (not `CONCURRENTLY`): the table has 0 rows,
> so the non-concurrent build takes an instant `ACCESS EXCLUSIVE` lock and avoids
> the "cannot run inside a transaction block" footgun of `CONCURRENTLY`.

Defence in depth (protects against a future non-Serializable caller, a script, or
`READ COMMITTED` fallback) would be a partial unique index:

```sql
-- PROPOSAL ONLY — NOT APPLIED. Requires explicit approval + migration review.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS maintenance_tasks_one_active_per_issue
  ON maintenance_tasks (source_issue_id)
  WHERE status IN ('OPEN', 'ASSIGNED');
```

Impact: no schema change for Prisma (`@@unique` cannot express a partial index,
so `schema.prisma` would only gain a comment); existing duplicate rows would make
the build fail, so a duplicate check must run first:

```sql
SELECT source_issue_id, count(*) FROM maintenance_tasks
WHERE status IN ('OPEN','ASSIGNED') GROUP BY 1 HAVING count(*) > 1;
```

In that case Prisma would surface `P2002` (already mapped to 409 by
`error.middleware.ts`), so no application change would be required.
`prisma db push` cannot create partial indexes — this must ship as a SQL
migration.

---

## 5. L3 — Issue → task conversion eligibility

**Root cause.** Only `triageStatus = REJECTED` and `status = CANCELLED` were
blocked, so a `NEEDS_INFO` issue (tenant has not supplied the requested
information) or a `COMPLETED` issue could still be turned into a marketplace task.

**Files.** `maintenanceTask.service.ts` — `CAN_CONVERT_TRIAGE_STATES` /
`CONVERTIBLE_LIFECYCLE_STATES` (L199-L221) and the guards in `createFromIssue`
(L312-L330).

| Condition | Result |
| --- | --- |
| `triageStatus` ∈ {`PENDING`, `REVIEWED`} **and** `status` ∈ {`PENDING`, `IN_PROGRESS`} | allowed |
| `triageStatus = NEEDS_INFO` | **409 `ISSUE_NEEDS_INFO`** ("re-accept the issue first") |
| `triageStatus = REJECTED` | **409 `ISSUE_REJECTED`** (Batch 2 invariant kept) |
| `status = CANCELLED` | **409 `ISSUE_CANCELLED`** |
| `status = COMPLETED` | **409 `ISSUE_ALREADY_COMPLETED`** |

Documented business rule for `PENDING`: creating a task from a report **is** the
landlord's "reviewed" decision, so it is allowed and recorded in the same
transaction as `PENDING → REVIEWED`. This keeps the normal UI path working (the
list shows both buttons for a brand-new report).

**Stale note.** The triage update now writes
`{ triageStatus: 'REVIEWED', triageNote: null, triageUpdatedAt: now }` **only
when** the issue is not already `REVIEWED`. A superseded "needs info"/rejection
reason therefore cannot survive as a contradiction of the new status, and no
pointless `triageUpdatedAt` bump happens on a no-op. Tenant issue content
(`title`, `description`, `category`, `priority`, images) is never overwritten by
the conversion — only the landlord-supplied task fields and the triage marker are
written. Eligibility check and task creation remain in the same transaction.

---

## 6. L4 — Application after assignment

**Root cause.** `apply` read `task.status` at the start of the transaction and
then inserted the application. An `accept`/`cancel` committing in between left a
`PENDING` application on an `ASSIGNED`/`CANCELLED` task.

**Files.** `maintenanceApplication.service.ts` (`apply`, L113-L133).

**Correction.** Immediately before the application write:

```ts
const stillOpen = await tx.maintenanceTask.updateMany({
  where: { id: taskId, status: 'OPEN' },
  data: { status: 'OPEN' },        // row lock + predicate re-evaluation
});
if (stillOpen.count !== 1) throw new AppError(..., 409, 'TASK_NOT_OPEN');
```

How the race is prevented (READ COMMITTED, which is the default for this
transaction):

* `apply` first: it holds the row lock until commit; a concurrent
  `accept`/`cancel` blocks, then re-evaluates its own
  `UPDATE … WHERE status='OPEN'` against the newest row version — the task is
  still OPEN, so it proceeds and **rejects every remaining `PENDING` application
  in the same transaction**. The application can therefore never remain PENDING
  on an assigned/cancelled task.
* `accept`/`cancel` first: the `apply` claim re-evaluates to 0 rows → **409
  `TASK_NOT_OPEN`**, nothing is written, no notification is sent.
* `@@unique([taskId, staffId])` is untouched, and `P2002` is already mapped to 409
  by `error.middleware.ts` (never 500).
* No new task state or transition is introduced: the claim re-writes the same
  `OPEN` value, so the marketplace workflow is unchanged.

`cancel` already rejects pending applications under the same conditional update,
so the invariant holds for both terminal transitions.

---

## 7. L5 — Staff eligibility re-checked at assignment

**Root cause.** `accept` only re-checked KYC/role/`isActive`. A staff member who
applied while available and skill-matched could disable "available" or delete the
skill and still be assigned.

**Files.** `maintenanceApplication.service.ts` (`accept`, L255-L335).

Re-checked **inside the same transaction and before any write**:

| Check | Failure |
| --- | --- |
| user exists, `role = STAFF`, `isActive` | 409 `STAFF_NOT_ELIGIBLE` |
| `staffProfile` exists | 409 `STAFF_PROFILE_REQUIRED` |
| `staffProfile.isAvailable` | 409 `STAFF_NOT_AVAILABLE` |
| skills ∩ `requiredCategories(task)` | 409 `STAFF_SKILL_MISMATCH` |
| KYC `APPROVED` (re-read via `loadKycState`) | 403 `STAFF_KYC_REQUIRED` |

* `requiredCategories` is the same helper `apply` uses (task skills, else task
  category), so apply-time and assign-time rules cannot drift.
* All checks fail **before** `maintenanceTask.updateMany(...)`/application
  updates, so there is no partial write: task stays `OPEN`, application stays
  `PENDING` (history preserved for the landlord to review or reject).
* Staff availability is never silently overridden — the landlord gets a 409 with a
  specific code.

---

## 8. Files changed

**New**

| File | Purpose |
| --- | --- |
| `server/src/services/maintenanceEvidence.service.ts` | token mint/verify, fetch-time authorization, payload decoration |
| `server/src/services/maintenanceEvidence.service.test.ts` | token + authorization matrix + SSRF/404/403 tests (19 tests) |
| `server/src/controllers/maintenanceImage.controller.ts` | streams authorized bytes with private/no-referrer headers |
| `server/src/routes/maintenanceImage.route.ts` | `GET /api/v1/maintenance-images/:kind/:id` + own limiter |
| `server/src/services/maintenance.service.test.ts` | M4 transition/409/atomicity + M2 payload tests (9 tests) |
| `server/docs/BATCH-2.1-REMEDIATION.md` | this document |

**Modified**

| File | Change |
| --- | --- |
| `server/src/services/storage.service.ts` | `getPrivateImageUrl(publicId, ttlSeconds?)` (`expires_at`), `isPrivateRef` |
| `server/src/services/maintenance.service.ts` | M2 private uploads + tokenized payloads on every issue response; M4 transition table + guarded triage write + audit trail |
| `server/src/services/maintenanceTask.service.ts` | M1 guarded edit; M2 private uploads, `taskSummarySelect` without URLs, tokenized payloads; L3 eligibility + stale-note clearing |
| `server/src/services/maintenanceApplication.service.ts` | L4 pre-insert OPEN claim; L5 full staff eligibility re-check; M2 tokenized accept payload |
| `server/src/app.ts` | mount image route before `apiLimiter`; morgan skips `/api/v1/maintenance-images` (no token in logs) |
| `client/lib/api.ts` | `resolveMediaUrl` resolves `/api/v1/…` against the API origin |
| `server/src/services/maintenanceTask.service.test.ts` | storage mock (private assets), M1 race test, M2 token tests |
| `server/src/services/maintenanceTask.fromIssue.test.ts` | private upload mock, `authenticated` cleanup, L3 tests, M2 payload test |
| `server/src/services/maintenanceApplication.service.test.ts` | L4 claim mock + L4 test, L5 availability/skill/profile tests |

**Not touched:** `prisma/schema.prisma`, any migration, `.env`, `.env.test`,
`package.json`, Batch 2 controllers/validations, Batch 3 scope.

---

## 9. Verification (actually executed)

| Check | Command | Result |
| --- | --- | --- |
| Server TypeScript | `node ./node_modules/typescript/bin/tsc --noEmit` (in `server/`) | **PASS** (0 errors) |
| Client TypeScript | `node ./node_modules/typescript/bin/tsc --noEmit` (in `client/`) | **PASS** (0 errors) |
| Client ESLint (changed file) | `eslint lib/api.ts` | **PASS** (0 problems) |
| Server ESLint | — | **NOT AVAILABLE** — the server package has no ESLint dependency/config |
| Focused suite | `vitest run src/services/maintenance*.test.ts` | **PASS** — 5 files, **78 tests** |
| Full suite | `vitest run` (NODE_ENV=test, `.env.test`) | **PASS** — 21 files, **204 tests** (includes the existing integration tests against the DEV database) |
| Prisma schema validation | not run | **N/A** — schema file untouched (byte-identical), so there is nothing new to validate |

Focused tests added for: task edit vs assignment race (M1), triage concurrency
and invalid transitions (M4), evidence token/authz/expiry/SSRF (M2), issue
conversion eligibility (L3), application vs assignment race (L4), staff
availability/skill/profile changes (L5).

**Not automated (recommended, not fabricated):**

* A real two-connection PostgreSQL race for `createFromIssue`
  (duplicate concurrent conversion). The unit test only covers the `P2034`
  mapping; a DB-level test would need a dedicated fixture and two independent
  transactions. Recommendation: an integration test that opens two
  `prisma.$transaction` clients, both runs the "no live task" read, then both
  inserts, and asserts exactly one commit + one `P2034`.
* End-to-end image delivery against a real Cloudinary account (needs credentials
  that this task was not allowed to use). The HTTP contract is covered with a
  stubbed `fetch`.

---

## 10. Regression protection (unchanged and re-verified)

Variant B flow (tenant issue → landlord triage → staff task), mandatory
`sourceIssueId`, landlord/staff shared KYC workflow, KYC gate inside the
application and assignment transactions, atomic assignment/cancellation, H-05
`authVersion`, refresh rotation, password provenance, WebSocket invalidation and
notification behaviour are all untouched; the full suite (including the
auth/session integration tests) passes.

Tenant issue history and evidence are preserved: no existing row is deleted or
rewritten, legacy URLs keep working through the authorized proxy, and a task edit
still cannot delete tenant evidence.

---

## 11. Remaining limitations

1. **Legacy public Cloudinary objects** (§3.4) are still publicly readable until
   the operational migration runs. Code-side privacy is complete for new data and
   for every API delivery path.
2. **Image proxy hop.** Bytes are fetched by the server, so delivery costs one
   extra request and the server holds up to 8 MB per in-flight image (bounded by a
   limiter). Acceptable for this workload; a CDN-fronted deployment should keep
   the same authorization and only replace the transport.
3. **Triage reason history** lives in `audit_logs` metadata, not in a dedicated
   history table (the model has a single `triage_note` column).
4. **Partial unique index** for M3 is proposed but not applied (§4.3).
5. **Landlord-staff scoping of `GET /maintenance-tasks/:id`** is unchanged
   (pre-existing Batch 2 behaviour, out of scope): a landlord-scoped staff member
   is not treated as the task owner there. It does not widen image access — the
   evidence route re-checks the relationship and will not hand out photos to a
   viewer without a business relationship.
