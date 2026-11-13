# BATCH 2.2 — M2 evidence migration + M3 index (approved & applied)

> **Lưu ý đường dẫn test (cập nhật Batch 4):** test đã chuyển từ `server/src/**` sang `server/tests/**`
> (giữ nguyên tên file). Các lệnh `npx vitest run src/...` dưới đây là bản ghi lịch sử.

Follow-up to `docs/BATCH-2.1-REMEDIATION.md` §3.4 (M2 operational migration) and
§4.3 (M3 partial unique index). Batch 2 functionality is unchanged; **Batch 3 is
not started**. No `schema.prisma` change, no `db push`, no Prisma migration.

Environment: Supabase **DEV** (`aws-0-ap-northeast-1.pooler.supabase.com`,
Cloudinary cloud `dewjsbayy`) only. Production not accessed.

---

## 0. Status summary

| Item | What was asked | Status |
| --- | --- | --- |
| **M2** | Migrate legacy public maintenance evidence to `authenticated` | **Tool delivered + executed** — DEV has **0** legacy maintenance image rows and **0** maintenance objects in Cloudinary, so there was nothing to convert. Proven end-to-end on a throwaway fixture instead (§2.3). |
| **M3** | Produce/prep the partial unique index SQL for approval | **Approved 2026-12-11 → applied to DEV and verified from `pg_catalog`** (§3.2–§3.5). Enforcement proven with rollback-only fixtures. |

Nothing was deleted and no row was repointed. The only DEV schema change is the
one index created by the approved statement (§3.3).

---

## 1. Delivered tooling

### 1.1 `server/scripts/maintenance-evidence-migration.js`

Resumable + idempotent. State and reports live in `server/scripts/reports/`
(git-ignored).

| Command | npm script | Behaviour |
| --- | --- | --- |
| `inventory` | `npm run evidence:inventory` | Read-only. Classifies every `maintenance_request_images.image_url` / `maintenance_task_images.image_url`, enumerates the Cloudinary maintenance folders (including orphans) and writes `reports/maintenance-evidence-inventory.json`. |
| `migrate --confirm [--limit=N]` | `npm run evidence:migrate` | Applies the per-asset migration. Without `--confirm` it prints the plan only. |
| `verify [--fixtures]` | `npm run evidence:verify` | Read-only DB audit + public-URL probes; `--fixtures` additionally runs the token/proxy authorization matrix on a throwaway request. |
| `selftest` | `npm run evidence:selftest` | Cloudinary-only scratch run (public → authenticated → destroy), no DB writes. |

Design points worth keeping:

* **URL classification is total**: `private-id` (post-2.1 `public_id`),
  `cloudinary-url` (legacy public URL), `local` (`/uploads/…`),
  `foreign-host` (never fetched — SSRF guard), `unsupported-path`, `malformed`,
  `empty`. No unexpected value in the DB can crash the run.
* **Per-asset idempotency**: the state file records every asset as
  `pending → copied → repointed → destroyed`, so an interrupted run resumes
  without re-uploading or double-destroying.
* **Order is never inverted**: bytes are copied and SHA-256-verified *before* the
  DB row is repointed, and the public object is destroyed *only after* the DB row
  points at the private copy. An abort leaves at worst an orphaned *public* object,
  never a broken evidence link.
* **Shared-asset safety**: `public_id`s that also appear in avatar / property /
  post / KYC columns are detected and never destroyed (they belong to another
  feature).
* **Async CDN invalidation**: `destroy()` returning `ok` does not mean the public
  URL stopped serving. `waitForPublicDeliveryToStop()` re-probes the public URL
  (4 attempts, 5 s apart) before the asset is marked done.
* **Token/proxy verification**: mints the same HMAC token the service mints
  (`base64url(JSON {k,i,u,r,e})` + HMAC-SHA256 with `JWT_SECRET`) and asserts the
  proxy's authorization matrix: tenant owner ✅, landlord owner ✅, admin ✅,
  unrelated tenant ❌ `EVIDENCE_FORBIDDEN`, unrelated staff ❌, tampered token ❌
  `EVIDENCE_TOKEN_INVALID`, expired token ❌, token bound to a different image id
  ❌, unknown image ❌ `EVIDENCE_NOT_FOUND`.

### 1.2 `server/scripts/apply-maintenance-task-index.js`

Read-only by default; `--confirm` applies. Preflight prints the columns, the
`MaintenanceTaskStatus` enum values, every existing index, then the duplicate
check. Duplicates ⇒ exit code **2** and *no* data change (the tool never "fixes"
business data). After applying it re-reads `pg_catalog`/`pg_indexes` and asserts
`unique = true` and a predicate mentioning `status`, `OPEN`, `ASSIGNED`.

### 1.3 `server/prisma/sql/maintenance_tasks_one_active_per_issue.sql`

The reviewed statement (one source of truth for the SQL), with the rationale and
the apply command. `prisma db push` cannot express partial indexes, so this stays
a plain SQL artefact applied by the script — deliberately *not* a
`prisma/migrations/*` folder (that would make `prisma migrate deploy` report
drift against an unseeded history).

---

## 2. M2 — actual execution record

### 2.1 Inventory (DEV, `reports/maintenance-evidence-inventory.json`)

```
issueRows: 0   taskRows: 0
kinds.issue: {private-id:0, cloudinary-url:0, local:0, foreign-host:0,
              unsupported-path:0, malformed:0, empty:0}
kinds.task : {private-id:0, cloudinary-url:0, local:0, foreign-host:0,
              unsupported-path:0, malformed:0, empty:0}
cloudFolderAssets: {total:0, public:0, authenticated:0, orphanPublic:0}
```

So both legacy-row classes are empty: `rental-management/maintenance-requests/*`
and `rental-management/maintenance-tasks/*` hold no assets, and no DB row
references a public Cloudinary URL. **There is no M2 backlog on DEV.**

### 2.2 Migration run

`npm run evidence:migrate` → `reports/maintenance-evidence-migration-result.json`:
0 assets pending, 0 migrated. Re-running is a no-op (nothing to upload, nothing
destroyed).

### 2.3 Proven instead of assumed — `selftest` (Cloudinary, no DB)

Because there was no real data, the migration *mechanism* was proven on a
throwaway asset (`reports/maintenance-evidence-selftest.json`, all ✅):

| Check | Result |
| --- | --- |
| `scratch-upload-public` | ✅ |
| `public-bytes-match-source` | ✅ (SHA-256) |
| `private-copy-created` | ✅ `explicit-failed(404), copy-uploaded, bytes-verified` |
| `private-signed-is-authenticated` | ✅ signed URL contains `/image/authenticated/` |
| `public-delivery-blocked` | ✅ `destroy=ok, probe=404, sau ~5s` |
| `private-still-readable` | ✅ bytes intact after the public copy was destroyed |

**Finding (corrects Batch 2.1 §3.4 step 1):** `uploader.explicit(public_id,
{ type: 'authenticated' })` returns **404** for these assets. Cloudinary cannot
re-register an existing public image as `authenticated`; the copy-bytes path is
the one that actually works, so the script tries `explicit` first (cheaper) and
always falls back to copy-bytes. **Finding 2:** after `destroy`, the public URL
still returned `200` until the CDN was invalidated — hence the polling helper.

### 2.4 Delivery-path verification (DEV, real DB rows, `--fixtures`)

`npm run evidence:verify -- --fixtures` → `reports/maintenance-evidence-verification.json`
→ `pass: true`, 12/12 checks. It created a real request + image row on DEV through
the service, asserted the payload contains only a tokenized proxy path (no
Cloudinary URL, no `public_id`), exercised the full authorization matrix above,
and cleaned up (rows 0, requests 0, asset destroyed).

> Implementation note fixed during this batch: `mintEvidenceUrl()` returns the
> full URL while `loadAuthorizedEvidence()` expects the raw token, so the script
> mints the token via a local `mintToken()` helper. Production code was not
> changed.


---

## 3. M3 — one active task per issue: preflight + SQL awaiting approval

### 3.1 Preflight (read-only, DEV) — `node scripts/apply-maintenance-task-index.js`

```
DEV target: db=postgres host=aws-0-ap-northeast-1.pooler.supabase.com
Columns:  source_issue_id: text  nullable=NO
          status: USER-DEFINED (MaintenanceTaskStatus) nullable=NO
Enum MaintenanceTaskStatus: OPEN, ASSIGNED, CANCELLED
Existing indexes: pkey(id), maintenance_tasks_assigned_application_id_key (UNIQUE),
                  maintenance_tasks_source_issue_id_idx (non-unique),
                  maintenance_tasks_landlord_id_status_idx,
                  maintenance_tasks_status_category_idx,
                  maintenance_tasks_status_urgency_idx
✅ Preflight: no issue with >1 OPEN/ASSIGNED task (maintenance_tasks is empty)
⚠️ Not applied (missing --confirm)
```

Exit code `0`. Both columns are `NOT NULL`, so there are no `NULL`-grouping
surprises; the predicate is stable under the enum's three values; and the existing
`maintenance_tasks_source_issue_id_idx` stays useful for non-active lookups.

### 3.2 Exact SQL — **approved by owner 2026-12-11, applied verbatim**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS maintenance_tasks_one_active_per_issue
  ON maintenance_tasks (source_issue_id)
  WHERE status IN ('OPEN', 'ASSIGNED');
```

* `CANCELLED` is outside the predicate ⇒ cancelled history never blocks a
  re-post (unlimited re-posts per issue, previous attempts preserved).
* Idempotent (`IF NOT EXISTS`) and re-verified from `pg_catalog` by the script.
* Non-`CONCURRENTLY` on purpose: 0 rows ⇒ instant build, and `CONCURRENTLY`
  cannot run inside a transaction block (the Prisma `$executeRawUnsafe` path).

### 3.3 Approval gate → execution record (2026-12-11)

Approved, then executed exactly once against **Supabase DEV**:

```bash
cd server
npm run db:index:one-active-task      # == node scripts/apply-maintenance-task-index.js --confirm
```

**Target confirmation before the write** (credentials/connection strings never
printed). `.env` → `DB_URL` is the DEV config; a SHA-256 fingerprint (12 hex) was
compared instead of the raw value:

| Check | Result |
| --- | --- |
| Active target host / database | `aws-0-ap-northeast-1.pooler.supabase.com` / `postgres` |
| Fingerprint of active `DB_URL` | `3ba7a76225af` |
| Fingerprint of `.env.test` `DB_URL` | `868ba6d23931` ⇒ **different**, so the run did not touch the test DB |
| Supabase host match | yes |
| `TARGET_IS_DEV` | `true` |

Script output (preflight clean, no duplicates ⇒ exit **0**):

```
✅ Preflight: không có sự cố nào có >1 công việc OPEN/ASSIGNED.
🚀 Đang áp dụng index...
✅ Đã tạo index
  CREATE UNIQUE INDEX maintenance_tasks_one_active_per_issue ON public.maintenance_tasks
    USING btree (source_issue_id)
    WHERE (status = ANY (ARRAY['OPEN'::"MaintenanceTaskStatus", 'ASSIGNED'::"MaintenanceTaskStatus"]))
  unique=true
✅ Xác minh từ pg_catalog: unique + partial trên (source_issue_id) WHERE status OPEN/ASSIGNED.
```

### 3.4 Independent post-apply verification (`pg_catalog` / `pg_indexes`)

Postgres rewrites `status IN ('OPEN','ASSIGNED')` as
`status = ANY (ARRAY['OPEN'::"MaintenanceTaskStatus", 'ASSIGNED'::"MaintenanceTaskStatus"])`,
so the predicate was compared **semantically** (enum casts stripped) *and* by
literal label extraction — not by substring matching:

| Check | Result |
| --- | --- |
| Row in `pg_index` for `maintenance_tasks_one_active_per_issue` | ✅ found |
| `indisvalid` / `indisready` | ✅ `true` / `true` |
| `indisunique` | ✅ `true` |
| Access method | ✅ `btree` |
| Key columns (`indnkeyatts` / `indnatts`) | ✅ `1` / `1` on `source_issue_id` |
| Predicate present (partial index) | ✅ `(status = ANY (ARRAY['OPEN'::"MaintenanceTaskStatus", 'ASSIGNED'::"MaintenanceTaskStatus"]))` |
| Exactly two enum labels, both expected | ✅ `labels=[OPEN,ASSIGNED]` |
| `CANCELLED` absent from predicate | ✅ |
| Visible in `pg_indexes` | ✅ |

**No unrelated schema or data change** (before/after snapshot taken minutes apart
on the same target):

* Indexes on `maintenance_tasks` — added: `maintenance_tasks_one_active_per_issue`;
  dropped: **none**; the other 6 unchanged
  (`_pkey`, `_assigned_application_id_key`, `_landlord_id_status_idx`,
  `_source_issue_id_idx`, `_status_category_idx`, `_status_urgency_idx`).
* Row counts identical before/after: `maintenance_tasks` 0, `maintenance_requests`
  0, `maintenance_task_images` 0, `maintenance_request_images` 0,
  `maintenance_task_applications` 0, `users` 38, `properties` 4, `rooms` 5.
* No `schema.prisma` edit, no `prisma db push`, no migration file, production not
  accessed.

### 3.5 Enforcement proven on DEV (fixtures rolled back)

A single interactive transaction created a throwaway issue + tasks (duplicate
attempts isolated with `SAVEPOINT` / `ROLLBACK TO SAVEPOINT`) and then **rolled
back deliberately**:

| Probe | Expected | Actual |
| --- | --- | --- |
| insert first `OPEN` | ok | ✅ ok |
| insert second `OPEN`, same `source_issue_id` | reject | ✅ Prisma `P2002` |
| insert `ASSIGNED`, same `source_issue_id` | reject | ✅ Prisma `P2002` |
| cancel the active task, then insert `OPEN` again | ok (re-post) | ✅ ok |
| insert a second `CANCELLED` for the same issue | ok (history) | ✅ ok |
| in-tx counts | `active=1, cancelled=2` | ✅ |

Residue after rollback: `maintenance_requests` 0, `maintenance_tasks` 0 — the
DEV data set is byte-for-byte unchanged.

### 3.6 Regression protection added in this batch

`src/services/maintenanceTask.fromIssue.test.ts` — new case
*"cho phép đăng lại sau khi công việc trước đã CANCELLED"*: it pins the
application-side duplicate query to `status: { in: ['OPEN', 'ASSIGNED'] }` and
proves a new task is created when no *active* task exists. That keeps the app
predicate and the index predicate from drifting apart (if someone adds `CANCELLED`
to the query, the test fails). The existing cases for "duplicate active task ⇒
409 `ISSUE_ALREADY_HAS_TASK`" and "Serializable loser (`P2034`) ⇒ 409" are
unchanged and still green.


---

## 4. Files changed in Batch 2.2

| File | Change |
| --- | --- |
| `server/scripts/maintenance-evidence-migration.js` | **new** — inventory/migrate/verify/selftest (M2) |
| `server/scripts/apply-maintenance-task-index.js` | **new** — M3 preflight + apply |
| `server/prisma/sql/maintenance_tasks_one_active_per_issue.sql` | **new** — reviewed SQL artefact |
| `server/package.json` | +`evidence:inventory`, `evidence:migrate`, `evidence:verify`, `evidence:selftest`, `db:index:one-active-task` |
| `.gitignore` | +`server/scripts/reports/` (reports + throwaway probes) |
| `server/src/services/maintenanceTask.fromIssue.test.ts` | +1 case (CANCELLED history does not block re-posting) |
| `server/docs/BATCH-2.1-REMEDIATION.md` | §3.4 and §4.3 updated with the empirical corrections and the Batch 2.2 status |
| `server/docs/BATCH-2.2-REMEDIATION.md` | **new** — this report |

Throwaway verification probes used for §3.4/§3.5 (`_m3-snapshot.js`,
`_m3-enforce-check.js`, `m3-snapshot-{before,after}.json`) live in the git-ignored
`server/scripts/reports/` and are not part of the deliverable.

No production file under `src/` changed (only a test file). No `schema.prisma`
change. `.env.test` untouched.

---

## 5. Verification actually executed

| Command | Result |
| --- | --- |
| `node scripts/maintenance-evidence-migration.js inventory` | ✅ 0 legacy rows, 0 maintenance folder assets |
| `… migrate --confirm` | ✅ no-op (nothing pending) |
| `… selftest` | ✅ 6/6 (copy fallback + destroy + CDN polling) |
| `… verify --fixtures` | ✅ 12/12, `pass: true`, fixtures cleaned |
| `node scripts/apply-maintenance-task-index.js` | ✅ exit 0, no duplicates, **not applied** (read-only preflight) |
| `npm run db:index:one-active-task` | ✅ exit 0 — **index created on DEV**, preflight clean, re-verified by the script |
| `pg_catalog` verification (independent) | ✅ 12/12 checks — exists, `indisunique=true`, partial, `labels=[OPEN,ASSIGNED]`, no `CANCELLED` |
| Before/after snapshot diff (DEV) | ✅ only added index; 0 dropped; all row counts identical |
| Enforcement probe (rollback-only) | ✅ 6/6 — duplicate `OPEN`/`ASSIGNED` ⇒ `P2002`; re-post after `CANCELLED` ⇒ ok; 0 residue |
| Focused maintenance tests (7 files, DEV) | ✅ **96/96 passed**, exit 0 |
| `server: npx tsc --noEmit` | ✅ exit 0 |
| `client: npx tsc --noEmit` | ✅ exit 0 |
| `client: npx eslint .` | ✅ exit 0 (0 errors, 144 pre-existing warnings — all `no-unused-vars`) |
| `server: vitest run` (full suite) | ✅ **21 files / 207 tests passed**, exit 0 |
| `server: npx prisma validate` | not run — `schema.prisma` untouched in this batch |

**How the full suite was run (important).** `npm test` loads `.env.test`, whose
database (`aws-0-eu-west-1…`) was **schema-drifted** (`column "auth_version" does
not exist`), so 5 DB-backed files failed there for reasons unrelated to this
batch. Per owner instruction ("use DEV, don't use the test DB"), the suite was run
against **DEV** by overriding only `DB_URL` for that one process
(`.env.test` untouched):

```powershell
cd server
node -e "const d=require('dotenv');const fs=require('fs');d.config({path:'.env.test'});const dev=d.parse(fs.readFileSync('.env'));process.env.DB_URL=dev.DB_URL;process.env.NODE_ENV='test';const r=require('child_process').spawnSync(process.platform==='win32'?'npx.cmd':'npx',['vitest','run'],{env:process.env,shell:true,stdio:'inherit'});process.exit(r.status??1)"
```

**Disclosure — test-DB side effect.** Before that instruction, one
`npm run db:test:init` invocation was started and the tool aborted it. A read-only
follow-up probe shows the `prisma db push` half had already completed against the
test database (`users.auth_version` now exists; the seeded rows are intact:
3 users including `tenant.test@rental.local`), while the `prisma/seed.ts` half was
cut off. No test was run against the test database afterwards, and nothing else was
changed there. Conclusion: the test DB is no longer schema-drifted, but its seed
step should be re-run (`npm run db:test:init` or `npm run db:test:seed`) if anyone
wants to execute the suite against it again.

DEV preconditions verified before relying on it: `users.auth_version` exists, and
the seeded `tenant.test@rental.local` / `landlord.test@rental.local` accounts exist
with password `TestPassword123!`. Post-run DEV check: **no new fixture residue**
(19 `batch4.session.*` users remain from a 2026-11-10 run with 0 refresh tokens
and 0 audit logs, i.e. nothing from today; property count unchanged at 4).

Both type-checks and client ESLint were run because they are the batch
definition-of-done gates; server has no ESLint toolchain installed (`eslint` is
absent from `devDependencies`, no config file), unchanged from Batch 2.1.

---

## 6. Remaining blockers / next steps

1. **M3 is done** — the index exists on DEV, verified from `pg_catalog`, and
   enforcement was proven with rollback-only fixtures. Remaining operational note:
   the index is **not** declared in `schema.prisma` (no `db push`, no migration file
   by design), so any future `prisma db push` / reset must be followed by
   `npm run db:index:one-active-task` (idempotent, `IF NOT EXISTS`) — or the index
   should be promoted into a reviewed migration at that time. No application change
   is needed: a violation surfaces as Prisma `P2002`, already mapped to **409** by
   `error.middleware.ts`.
2. **M2 is operational, not code**: DEV has nothing to migrate, but any other
   environment (staging/production) must run `npm run evidence:inventory` →
   review the JSON → `npm run evidence:migrate` → `npm run evidence:verify`. The
   tool is safe to re-run; `--limit=N` bounds a first batch; never bulk-delete the
   public objects first.
3. **Test database** (environment, not code): it was schema-drifted at the start of
   this batch; the aborted `db:test:init` did apply the schema (see §5 disclosure)
   but its seed step was cut off. Re-run `npm run db:test:init` there before using
   it again. `DB_URL` in `.env.test` was not modified.
4. **Batch 3 has not been started**, as instructed.

