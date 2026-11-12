# Auth hardening (H-01/H-02) — deployment runbook

**Status: DRAFT — prepared, NOT executed against any production data.** Every SQL
statement below is a proposal for a DBA/operator to review and run by hand.
The §3 and §4 statements *were* exercised against the **test** database inside
transactions that were always rolled back (§3.6, §4.5) to prove the guards fire and
the classifications are correct; nothing was persisted and no statement has been run
against a live dataset. The change itself includes no schema migrations
(`prisma/migrations` is empty) and no `.env` edit.

A3/A4 are the reviewed shape as of this revision: A3 proves the group's membership
is **exactly** the approved set and takes a table-level lock so no writer can add a
member mid-remediation (§3.3, §3.3.1 — including exactly what that lock blocks and
what it does not); A4 restores the loser's **original** `is_active` from the
rollback mapping, corroborated against the audit row A3 wrote, and acts on that exact
record (the `audit_id` A3 prints) while allowing the survivor A3 left holding the
address to keep it (§3.5, §3.5.2). Dry-run evidence: 19 A4 scenarios after the
Findings 9/10 rewrite, all abort paths verified to leave `users`, `refresh_tokens`
and `audit_logs` untouched (§3.6).

Related documents: [`SEED-DATA.md`](./SEED-DATA.md).

## 1. Scope

| Item | In scope |
|---|---|
| Email normalization + ambiguity fail-closed (`src/utils/email.ts`, `src/services/auth.service.ts`, `src/validations/auth.validation.ts`) | yes |
| Prisma `P2002` detection for `users.email` (`src/utils/prisma-errors.ts`) | yes |
| Google OAuth state validation, code exchange, account claim (`loginWithGoogle`) | yes |
| Session issuance / refresh rotation with `users → refresh_tokens` lock order (`issueSession`, `refresh`) | yes |
| Admin deactivation revoking live refresh tokens in the same transaction (`adminService.updateUserStatus`) | yes |
| Schema changes, `prisma db push`, migrations | **no** |
| H-04 (access token lifetime vs deactivation) | **no** |
| `.env` / credential changes | **no** |

Data remediation is required for three legacy conditions that the code now
handles *safely but visibly* (fail closed instead of guessing):

| # | Condition | Runtime behaviour today |
|---|---|---|
| A | Two or more `users` rows whose emails differ only by case | Lookups are `mode: 'insensitive'` and fail closed with `400 Email này đã được sử dụng` |
| B | `password_hash` that is not a usable bcrypt hash (and not the `!` sentinel) | Password login always fails closed with the generic `401`; the user can only recover via password reset or Google |
| C | `refresh_tokens.revoked_at IS NULL` belonging to `is_active = false` users | Rotation already refuses them (401), but the rows are still "live" in the table |

## 2. Prerequisites

1. **Deploy artifact**: `npx tsc --noEmit` and `npm run build` green on the
   commit to deploy (see §8).
2. **Database access**: a **read-only** role for the §3/§4/§5 inventories, and a
   separate change-approved role for the §3.3 and §5.3 remediation. Never reuse
   the application's `DB_URL` for manual work if a dedicated role exists.
3. **Backup**: take a snapshot/PITR marker immediately before any remediation
   statement. Record it in the change ticket.
4. **Environment**: `DB_URL`, `JWT_SECRET` (min 32 chars) already present.
   Google login additionally needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` /
   `GOOGLE_REDIRECT_URI` (fallbacks: `CLIENT_ID` / `CLIENT_SECRET`). **This batch
   requires no `.env` edit.**
5. **Tooling**: `psql` (or the Supabase SQL editor) with `ON_ERROR_STOP=1`, and a
   second read-only session to verify results while the app stays up.
6. **Confirm the write target is not a replica**: `SELECT pg_is_in_recovery();`
   must return `false` before writing anything.
7. **Schema-qualify every statement — mandatory.** This database is a Supabase
   project: the `auth` schema already contains its own GoTrue `users` and
   `refresh_tokens` tables (different columns: `encrypted_password`,
   `confirmation_token`, `revoked` boolean, …) and `search_path` is
   `"$user", public, extensions`. Unqualified `users` happens to resolve to
   `public.users` today, but if the session role/schema is ever `auth` the
   statements below would read or **write GoTrue rows** — an `UPDATE users SET
   email = …` there would hijack Supabase Auth accounts, and B1/B2/B3 would
   silently report GoTrue rows instead of application rows. Every statement in
   this runbook is written as `public.users` / `public.refresh_tokens` /
   `public.password_reset_tokens` / `public.audit_logs`; keep the prefix when
   copying. Sanity check the session first:
   `SELECT current_user, current_schema();` and `SHOW search_path;`.
8. **No `::uuid` casts.** `public.users.id`, `public.refresh_tokens.user_id`,
   `public.password_reset_tokens.user_id` and
   `public.audit_logs.id`/`entity_id` are Prisma `String` → **`text`** in this
   schema, even though the values look like UUIDs. Casting them to `uuid` fails
   with `42883`/`22P02`; keep them as quoted text. The only place a text value
   must be produced from a UUID is `audit_logs.id`, which is filled with
   `gen_random_uuid()::text`.

### 2.1 Deploy order

| Step | When | Requires downtime |
|---|---|---|
| Application deploy (this change) | first | no |
| §3 duplicate-email inventory, then remediation | within the same change window, after the deploy | no |
| §4 legacy hash inventory | any time after the deploy (read-only) | no |
| §5 inactive-user token cleanup | any time after the deploy (idempotent, chunked) | no |

The deploy is not blocked on the data work: duplicates fail closed (`400`), bad
hashes fail closed (`401`), and stale live tokens are already rejected by
rotation.

## 3. Item A — duplicate-email inventory and remediation

### 3.1 Inventory (read-only)

```sql
-- A1: groups of rows that collide after lower-casing
SELECT lower(u.email)                                    AS email_key,
       count(*)                                          AS rows,
       array_agg(u.id     ORDER BY u.created_at, u.id)    AS user_ids,
       array_agg(u.email  ORDER BY u.created_at, u.id)    AS stored_emails,
       array_agg(u.is_email_verified ORDER BY u.created_at, u.id) AS verified,
       array_agg(u.is_active         ORDER BY u.created_at, u.id) AS active
FROM public.users u
GROUP BY lower(u.email)
HAVING count(*) > 1
ORDER BY rows DESC, email_key;
```

```sql
-- A2: per-row detail used to pick the survivor (sessions, reset tokens)
SELECT u.id, u.email, u.role, u.is_active, u.is_email_verified,
       u.created_at, u.updated_at,
       (SELECT count(*) FROM public.refresh_tokens rt
         WHERE rt.user_id = u.id AND rt.revoked_at IS NULL) AS live_refresh_tokens,
       (SELECT max(rt.created_at) FROM public.refresh_tokens rt
         WHERE rt.user_id = u.id)                           AS last_session_at,
       (SELECT count(*) FROM public.password_reset_tokens prt
         WHERE prt.user_id = u.id)                          AS reset_tokens
FROM public.users u
WHERE lower(u.email) IN (
  SELECT lower(email) FROM public.users GROUP BY lower(email) HAVING count(*) > 1
)
ORDER BY lower(u.email), u.created_at, u.id;
```

Every ordering in A1/A2 carries `id` as the final key so the CSV is stable across
re-runs: `created_at` alone is not unique (rows created in the same statement or
in the same millisecond tie), and a re-run that ordered differently would produce
a rollback mapping that no longer matches the export.

Record the output (CSV) in the change ticket — it is the rollback mapping. For every
row it must keep `id`, `email` **exactly as stored** (A2), `is_active` (A2),
`role`, `created_at` and `last_session_at`; A4 (§3.5) needs `email` and
`is_active` verbatim and refuses to run without them. After A3 runs, add to the
ticket row it processed the **`audit_id` A3 printed** and the `survivor_id` it used:
A4 identifies the exact remediation by that audit id and re-verifies ownership from
the `survivor_id` recorded in it (§3.5.2).

### 3.2 Decision rules (apply in order)

1. **Survivor** = the first row of this deterministic sort applied to the group
   (columns from A2). `NULLS LAST` is required: a row with no session has
   `last_session_at = NULL`, and PostgreSQL sorts `NULL` **first** under `DESC`,
   which would hand the account to the row that has never been used.

   ```sql
   -- fragment, NOT a standalone statement: append it to A2
   ORDER BY u.is_email_verified DESC,   -- verified first
            u.is_active         DESC,   -- then active
            last_session_at     DESC NULLS LAST,  -- then most recent session
            u.created_at        ASC,    -- then oldest account
            u.id                ASC;    -- final deterministic tie-break
   ```

   `u.id` is unique and `text`, so the ordering is total: two operators replaying
   the same inventory always choose the same survivor. Document any decision that
   contradicts this order and why.
2. **Losers are quarantined, never deleted.** `users` is referenced by many
   tables (`refresh_tokens`, `posts`, `contracts`, `audit_logs`, …), so deleting
   a row is a data-loss operation. Renaming the email frees the unique index
   while preserving every foreign key.
3. Quarantine address: `lower(email) || '+legacy-' || id || '@quarantine.invalid'`.
   It cannot collide with a real address, and it keeps the original address owned
   by the survivor (so the address cannot be re-registered by someone else).
4. Quarantined rows are deactivated (`is_active = false`) and their live refresh
   tokens revoked, so no session survives the rename. **A loser that was already
   inactive stays inactive and is remediated the same way** — remediation does not
   reactivate anything, and the rollback does not either.
5. **The approved set is exact, not a count.** A3 takes the group's ids as an
   `ARRAY[…]` and aborts unless the current key membership is *exactly* that set
   (`extra`/`missing` are reported). Two ids that still match are not enough: if a
   third account appeared on the same normalized address, the plan is stale and
   must be re-derived, because quarantining a subset would leave a duplicate
   behind and could quarantine the wrong pair.

### 3.3 Remediation (DRAFT — DO NOT RUN WITHOUT APPROVAL)

Run **one group at a time**, from the CSV produced by §3.1/§3.2. The block below is
a single `DO` statement wrapped in one transaction: every guard raises an
exception, which aborts the transaction, so a stale plan can never half-apply.
Replace the placeholders with the values recorded in the ticket, and **record the
`audit_id` the block prints into that same ticket row**: A4 (§3.5) selects the
remediation record by that primary key, so the rollback can only ever reverse *this*
run (§3.5.2, Finding 10).

```sql
-- A3: remediate ONE duplicate group (ids are text — never cast them to uuid)
BEGIN;

DO $a3$
DECLARE
  v_group        text    := '<email_key>';        -- lower-case canonical address
  v_survivor     text    := '<survivor_id>';      -- chosen with the §3.2 ordering
  v_loser        text    := '<loser_id_1>';
  v_group_ids    text[]  := ARRAY['<survivor_id>', '<loser_id_1>'];  -- the exact approved set
  v_expected_ids text[];   -- v_group_ids, sorted
  v_current_ids  text[];   -- every id currently on the key, sorted
  v_extra        text[];
  v_missing      text[];
  v_quarantine   text;
  v_locked       int;
  v_updated      int;
  v_revoked      int;
  v_orig_email   text;
  v_orig_active  boolean;
  v_audit_id     text;     -- primary key of the audit row this run writes (A4 quotes it back)
BEGIN
  -- 1. the plan itself must be coherent --------------------------------------
  IF v_group_ids IS NULL OR array_length(v_group_ids, 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'ABORT: the approved id set must contain exactly 2 ids, got %', v_group_ids;
  END IF;
  IF NOT (v_survivor = ANY (v_group_ids)) THEN
    RAISE EXCEPTION 'ABORT: survivor % is not a member of the approved id set %',
      v_survivor, v_group_ids;
  END IF;
  IF NOT (v_loser = ANY (v_group_ids)) THEN
    RAISE EXCEPTION 'ABORT: loser % is not a member of the approved id set %',
      v_loser, v_group_ids;
  END IF;
  IF v_loser = v_survivor THEN
    RAISE EXCEPTION 'ABORT: survivor and loser are the same id (%)', v_survivor;
  END IF;

  SELECT array_agg(x ORDER BY x) INTO v_expected_ids FROM unnest(v_group_ids) x;

  -- 2. freeze every writer on public.users for the rest of the transaction ----
  --    Row locks cannot stop a phantom INSERT on this key: the unique index on
  --    email is case-sensitive while the key is lower(email), so a concurrent
  --    registration is never blocked by `FOR UPDATE`. EXCLUSIVE conflicts with
  --    ROW EXCLUSIVE (every INSERT/UPDATE/DELETE) and with ROW SHARE
  --    (SELECT ... FOR UPDATE), but NOT with ACCESS SHARE, so plain reads keep
  --    working. NOWAIT makes A3 fail immediately instead of queueing behind a
  --    writer — see "Concurrency" below.
  LOCK TABLE public.users IN EXCLUSIVE MODE NOWAIT;

  -- 3. the group's CURRENT membership must be exactly the approved set --------
  SELECT array_agg(u.id ORDER BY u.id) INTO v_current_ids
  FROM public.users u
  WHERE lower(u.email) = v_group;
  v_current_ids := coalesce(v_current_ids, ARRAY[]::text[]);

  IF v_current_ids IS DISTINCT FROM v_expected_ids THEN
    SELECT coalesce(array_agg(x ORDER BY x), ARRAY[]::text[]) INTO v_extra
    FROM unnest(v_current_ids) x WHERE x <> ALL (v_expected_ids);
    SELECT coalesce(array_agg(x ORDER BY x), ARRAY[]::text[]) INTO v_missing
    FROM unnest(v_expected_ids) x WHERE x <> ALL (v_current_ids);
    RAISE EXCEPTION
      'ABORT: group membership changed since inventory (key=%, approved=%, current=%, extra=%, missing=%)',
      v_group, v_expected_ids, v_current_ids, v_extra, v_missing;
  END IF;

  -- 4. lock the rows in id order (same order the application uses) -----------
  PERFORM 1
  FROM public.users
  WHERE id = ANY (v_group_ids)
  ORDER BY id
  FOR UPDATE;
  GET DIAGNOSTICS v_locked = ROW_COUNT;
  IF v_locked <> 2 THEN
    RAISE EXCEPTION 'ABORT: expected 2 group rows, locked %', v_locked;
  END IF;

  -- 5. the survivor must still be the active account we validated ------------
  IF NOT EXISTS (SELECT 1 FROM public.users
                 WHERE id = v_survivor AND lower(email) = v_group AND is_active) THEN
    RAISE EXCEPTION 'ABORT: survivor % is gone, renamed or deactivated', v_survivor;
  END IF;

  -- 6. the quarantine address must be free (unique index is case-sensitive) ---
  v_quarantine := v_group || '+legacy-' || v_loser || '@quarantine.invalid';
  IF EXISTS (SELECT 1 FROM public.users
             WHERE email = v_quarantine OR lower(email) = lower(v_quarantine)) THEN
    RAISE EXCEPTION 'ABORT: quarantine address % is already used', v_quarantine;
  END IF;

  -- 7. remember the pre-change state (A4 restores it verbatim) --------------
  --    A loser may ALREADY be inactive before remediation; that is not an error
  --    and must not be "normalised" to true on rollback.
  SELECT email, is_active INTO v_orig_email, v_orig_active
  FROM public.users
  WHERE id = v_loser;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABORT: loser % does not exist', v_loser;
  END IF;

  UPDATE public.users
  SET email      = v_quarantine,
      is_active  = false,
      updated_at = now()
  WHERE id = v_loser
    AND lower(email) = v_group;      -- guard against a stale plan
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'ABORT: expected exactly 1 loser row updated, got %', v_updated;
  END IF;

  UPDATE public.refresh_tokens
  SET revoked_at = now()
  WHERE user_id = v_loser
    AND revoked_at IS NULL;
  GET DIAGNOSTICS v_revoked = ROW_COUNT;

  -- 8. write the remediation record; its id is the handle A4 quotes back -----
  v_audit_id := gen_random_uuid()::text;
  INSERT INTO public.audit_logs (id, action, entity_type, entity_id, metadata, created_at)
  VALUES (v_audit_id, 'ADMIN_EMAIL_DEDUP', 'User', v_loser,
          jsonb_build_object('email_key', v_group,
                             'survivor_id', v_survivor,
                             'quarantine_address', v_quarantine,
                             'original_email', v_orig_email,
                             'original_is_active', v_orig_active,
                             'revoked_refresh_tokens', v_revoked,
                             'reason', 'duplicate email differing only by case'),
          now());

  RAISE NOTICE 'OK: loser % quarantined as %, was (email=%, is_active=%), % refresh token(s) revoked, audit_id=% — copy that id into the ticket, A4 requires it',
    v_loser, v_quarantine, v_orig_email, v_orig_active, v_revoked, v_audit_id;
END
$a3$;

COMMIT;   -- if any guard raised, the server reports ERROR + ROLLBACK: nothing changed
```

### 3.3.1 Concurrency: what A3's locks do and do not protect

`FOR UPDATE` on the group's rows is **not enough**, and the runbook does not claim
otherwise:

- The unique index on `public.users.email` is **case-sensitive**, while the
  duplicate key is `lower(email)` (`citext` is not used and no functional index
  exists). Two registrations of `Foo@x` and `foo@x` are both legal at the index
  level, so PostgreSQL cannot enforce the invariant A3 is repairing.
- `SELECT … FOR UPDATE` locks only rows that **already exist**. A concurrent
  `INSERT` of a third row on the same normalized key is not blocked by any row
  lock — a *phantom*. Locking A and B therefore proves nothing about C.

A3 closes this in two layers, because either one alone is insufficient:

| Layer | Closes | What it cannot do |
|---|---|---|
| Step 3 exact-set assertion | Drift between the inventory (§3.1) and the start of A3 — the whole point of Finding 7 (extra member, missing member, wrong pairing) | An insert that lands *after* the assertion (TOCTOU) |
| Step 2 `LOCK TABLE public.users IN EXCLUSIVE MODE NOWAIT` | That TOCTOU window: no writer can commit a new row on the key until A3 commits or rolls back | Protect the database *after* commit — a later duplicate is possible and is handled by the app failing closed (§1) and by the next inventory run |

Effect of the table lock on the application, precisely:

- **Allowed:** plain `SELECT` (ACCESS SHARE) — `authenticate` /
  `authenticateOptional` re-reads, `/auth/me`, listings. Read paths are unaffected.
- **Blocked while A3 runs:** everything that takes ROW EXCLUSIVE (`INSERT`,
  `UPDATE`, `DELETE` on `public.users`: register, Google claim, admin
  deactivate, password-reset writes) and everything that takes ROW SHARE
  (`SELECT … FOR UPDATE` — `issueSession`, `refresh`, `adminService.updateUserStatus`).
  They wait for A3's `COMMIT`/`ROLLBACK`, which is milliseconds.
- **Why `NOWAIT`:** without it A3 would queue behind an in-flight writer while
  holding nothing, and could sit there; the operator would see a hang instead of
  a decision. With `NOWAIT`, A3 aborts immediately with
  `55P03 lock_not_available` if any writer or `FOR UPDATE` reader is active, and
  the operator retries. This also keeps A3 deadlock-free: it only acquires the
  table lock when no session holds a row lock on `public.users`, so the row locks
  in step 4 can never be held by someone who is simultaneously waiting for A3.
- **Residual, stated honestly:** a writer that starts after A3 commits can create a
  new duplicate. Application lookups fail closed with `400 Email này đã được sử
  dụng` (never a wrong session), and §3.1 re-run detects it. If the change policy
  requires a stricter window, run A3 with registration quiesced (maintenance mode
  or a change window) — that removes even the millisecond-level blocking of
  writers; the SQL does not do it for you.
- **Requires:** the session must own `public.users` (table owner or superuser) to
  take a table-level lock; the app's own `DB_URL` role normally qualifies.

Operator notes:

- Run it with `ON_ERROR_STOP=1`. If the block raises `ABORT: …`, the server reports
  `ERROR` followed by `ROLLBACK` and the group is untouched. Investigate the drift
  (someone re-registered the address, a password was reset, a row was deleted) and
  re-derive the plan from A1/A2 — never relax a guard to make it pass.
- `gen_random_uuid()::text`: `audit_logs.id` is `text` in this schema (§2 item 8)
  and the Prisma client normally fills it. `gen_random_uuid()` is built in since
  PostgreSQL 13; with `pgcrypto` on an older server use `uuid_generate_v4()` and
  keep the `::text` cast. The value is held in `v_audit_id`, used as the inserted
  row's primary key **and printed** (`audit_id=…`): copy it into the ticket, because
  A4 accepts no other handle (§3.5.2, Finding 10).
- `entity_type = 'User'` follows the existing convention in
  `adminService.updateUserStatus`. `user_id` stays `NULL` because the SQL session
  carries no application identity — record the operator in the change ticket.
- Lock order: the block freezes table-level writers on `public.users` (step 2),
  then locks the group's `public.users` rows **in `id` order** (the order the
  application uses), and only then touches `public.refresh_tokens`. No application
  path takes `refresh_tokens` before `users`, so there is no deadlock cycle.
- Why the guards, in the order they fire: the plan check (exactly two ids, survivor
  and loser both members, distinct) rejects a mistyped or cross-wired ticket; the
  **exact-set assertion** is the one that proves A and B are still the complete
  group — a count of 2 alone passes when a third row C appeared with the same key,
  which is exactly the case that must abort; the survivor check catches a
  deactivated or deleted survivor; the quarantine check covers the case-sensitive
  unique index vs. the case-insensitive lookup; and `ROW_COUNT = 1` on the loser
  update is the load-bearing assertion — everything before it only reduces the
  chance of touching the wrong row.
- `original_email` / `original_is_active` are written into the audit row on
  purpose: A4 (§3.5) corroborates the ticket CSV against them, so a rollback can
  never invent an active state. `quarantine_address` and `survivor_id` are written
  for the same reason — they let A4 prove that the record it was handed describes
  *this* row state and name the only other account allowed to hold the restored
  address (§3.5.2). A loser that was **already inactive** before A3 is
  normal — it is still quarantined and its live tokens still revoked, and its
  rollback restores `is_active = false`, not `true`.
- Keep one group per transaction. Never mix groups, and never add "cleanup" DML
  for other users to the same transaction.
- The rename is safe while the app is up: writers serialize behind the table lock
  for milliseconds and no application path locks `users` after `refresh_tokens`.
  See §3.3.1 for the exact effect on application writes and the residual.

### 3.4 Verification (read-only)

```sql
SELECT count(*) AS remaining_duplicate_groups
FROM (SELECT lower(email) FROM public.users
      GROUP BY lower(email) HAVING count(*) > 1) d;
-- expect 0

SELECT count(*) AS quarantined_rows,
       count(*) FILTER (WHERE is_active) AS still_active
FROM public.users
WHERE email LIKE '%+legacy-%@quarantine.invalid';
-- expect quarantined_rows = number of losers processed, still_active = 0

-- the audit trail of what you did, one row per loser (id = the audit_id in the ticket)
SELECT id, entity_id, metadata, created_at
FROM public.audit_logs
WHERE action = 'ADMIN_EMAIL_DEDUP'
ORDER BY created_at DESC;
```

Functional check: `POST /api/v1/auth/login` with the affected address must now
return `200` for the survivor (correct password) or the generic `401` (wrong
password) — never `400 Email này đã được sử dụng`.

### 3.5 Rollback

Reverse the rename by primary key using the ticket CSV. Like A3, the block is
guarded: it only restores a row that is **still** exactly in the state remediation
left it in, it acts on the **one** audit record the ticket names (never "the latest
row for this user"), and it treats the survivor A3 left holding the address as the
expected owner instead of a conflict.

```sql
-- A4: rollback of ONE remediated group (DRAFT)
BEGIN;

DO $a4$
DECLARE
  v_audit_id      text   := '<audit_id>';             -- the id A3 printed for THIS remediation
  v_loser         text   := '<loser_id_1>';
  v_group         text   := '<email_key>';            -- lower-case address
  v_original      text   := '<original_email>';       -- exactly as stored before A3
  v_orig_active_s text   := '<original_is_active>';   -- literal 'true' or 'false' (ticket CSV)
  v_orig_active   boolean;
  v_quarantine    text;
  v_meta          jsonb;
  v_survivor      text;
  v_survivor_email text;
  v_other_owner   text;
  v_current       public.users%ROWTYPE;
  v_updated       int;
BEGIN
  -- 1. the rollback mapping must be complete and explicit --------------------
  IF v_audit_id IS NULL OR btrim(v_audit_id) = '' THEN
    RAISE EXCEPTION 'ABORT: audit_id is missing — quote the id A3 printed for this remediation';
  END IF;
  IF v_original IS NULL OR btrim(v_original) = '' THEN
    RAISE EXCEPTION 'ABORT: original_email is missing from the rollback mapping';
  END IF;
  IF v_orig_active_s IS NULL OR v_orig_active_s NOT IN ('true', 'false') THEN
    RAISE EXCEPTION 'ABORT: original_is_active must be literally true or false (got %)',
      coalesce(v_orig_active_s, '<null>');
  END IF;
  v_orig_active := v_orig_active_s::boolean;

  -- the ticket must be internally consistent: original_email sits on the key
  IF lower(v_original) IS DISTINCT FROM v_group THEN
    RAISE EXCEPTION 'ABORT: original_email % is not on key % (ticket is cross-wired)',
      v_original, v_group;
  END IF;

  v_quarantine := v_group || '+legacy-' || v_loser || '@quarantine.invalid';

  -- 2. freeze every writer on public.users (same control as A3, §3.3.1) -----
  LOCK TABLE public.users IN EXCLUSIVE MODE NOWAIT;

  SELECT * INTO v_current
  FROM public.users
  WHERE id = v_loser
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABORT: user % no longer exists', v_loser;
  END IF;

  -- expected post-remediation state: a human already changed it -> stop
  IF v_current.email <> v_quarantine THEN
    RAISE EXCEPTION 'ABORT: current email % is not the quarantine address % (state changed after remediation)',
      v_current.email, v_quarantine;
  END IF;
  IF v_current.is_active IS NOT FALSE THEN
    RAISE EXCEPTION 'ABORT: user % is active again (state changed after remediation)', v_loser;
  END IF;

  -- 3. read the ONE remediation record this ticket refers to (Finding 10) ----
  --    Selected by primary key, never by "latest row for this user": a later A3
  --    for another group, or a second remediation of the same user, must not be
  --    able to answer for this one (§3.5.2).
  SELECT metadata INTO v_meta
  FROM public.audit_logs
  WHERE id          = v_audit_id
    AND action      = 'ADMIN_EMAIL_DEDUP'
    AND entity_type = 'User'
    AND entity_id   = v_loser;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABORT: audit record % is not an ADMIN_EMAIL_DEDUP row of user %',
      v_audit_id, v_loser;
  END IF;
  IF v_meta->>'email_key' IS DISTINCT FROM v_group THEN
    RAISE EXCEPTION 'ABORT: audit record % belongs to key %, ticket says %',
      v_audit_id, v_meta->>'email_key', v_group;
  END IF;
  -- tie the record to the row state in front of us, not to an earlier attempt
  IF v_meta->>'quarantine_address' IS DISTINCT FROM v_current.email THEN
    RAISE EXCEPTION 'ABORT: audit record % recorded quarantine address %, but user % holds %',
      v_audit_id, v_meta->>'quarantine_address', v_loser, v_current.email;
  END IF;
  IF v_meta->>'original_email' IS DISTINCT FROM v_original THEN
    RAISE EXCEPTION 'ABORT: audit record recorded original_email %, ticket says %',
      v_meta->>'original_email', v_original;
  END IF;
  IF v_meta->>'original_is_active' IS DISTINCT FROM v_orig_active_s THEN
    RAISE EXCEPTION 'ABORT: audit record recorded original_is_active %, ticket says %',
      v_meta->>'original_is_active', v_orig_active_s;
  END IF;

  v_survivor := v_meta->>'survivor_id';
  IF v_survivor IS NULL OR btrim(v_survivor) = '' THEN
    RAISE EXCEPTION 'ABORT: audit record % carries no survivor_id — ownership cannot be verified',
      v_audit_id;
  END IF;
  IF v_survivor = v_loser THEN
    RAISE EXCEPTION 'ABORT: audit record % names the loser as its own survivor', v_audit_id;
  END IF;

  -- 4. the survivor must still hold the normalized original address (Finding 9)
  --    A3 leaves that address with the survivor on purpose, so treating "someone
  --    already owns it" as a conflict would abort every legitimate rollback.
  SELECT email INTO v_survivor_email
  FROM public.users
  WHERE id = v_survivor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABORT: survivor % no longer exists; re-run §3.1 and restore from the snapshot instead',
      v_survivor;
  END IF;
  IF lower(v_survivor_email) IS DISTINCT FROM v_group THEN
    RAISE EXCEPTION 'ABORT: survivor % no longer owns % (it now holds %); refusing to restore into a changed group',
      v_survivor, v_group, v_survivor_email;
  END IF;

  -- 5. nobody else may own the normalized original address ------------------
  --    Allowed owners are exactly two: the quarantined loser and the survivor
  --    the audit record names. Any third owner means the address was claimed
  --    after remediation and the restore would have to overwrite it.
  SELECT string_agg(u.id || ' <' || u.email || '>', ', ' ORDER BY u.id)
  INTO v_other_owner
  FROM public.users u
  WHERE u.id NOT IN (v_loser, v_survivor)
    AND lower(u.email) = lower(v_original);
  IF v_other_owner IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: % (normalized) is also owned by %; refusing to restore',
      v_original, v_other_owner;
  END IF;

  -- 6. restore the exact original state (is_active included) ----------------
  UPDATE public.users
  SET email      = v_original,
      is_active  = v_orig_active,
      updated_at = now()
  WHERE id = v_loser
    AND email = v_quarantine       -- only the row that was just inspected
    AND is_active = false;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'ABORT: expected exactly 1 row restored, got %', v_updated;
  END IF;

  -- Refresh tokens revoked by A3 stay revoked: A4 restores the account, not the
  -- sessions the duplicate invalidated.
  RAISE NOTICE 'OK: % restored to % with is_active=% (survivor % keeps %), tokens stay revoked; audit %',
    v_loser, v_original, v_orig_active, v_survivor, v_survivor_email, v_audit_id;
END
$a4$;

COMMIT;
```

### 3.5.1 `is_active` is restored verbatim (never assumed)

Revoked refresh tokens stay revoked (correct: those sessions were suspended), and
`is_email_verified` is not touched by either direction.

**`is_active` is restored verbatim, never assumed.** A3 records the loser's
pre-change `email` and `is_active` in the `ADMIN_EMAIL_DEDUP` audit row; A4 takes
the same two values from the ticket CSV and aborts unless the audit row agrees.
A loser that was already inactive before remediation therefore comes back
`is_active = false`. The "abort rather than guess" guards are: a missing `audit_id`,
an un-replaced `original_email`, or a non-boolean `original_is_active` is rejected
before any lock is taken; an `audit_id` that is not an `ADMIN_EMAIL_DEDUP` record of
this user aborts; and any disagreement between the CSV and the record's metadata
(`email_key`, `quarantine_address`, `original_email`, `original_is_active`,
`survivor_id`) aborts.

Requirement for the ticket: the rollback mapping produced in §3.1/§3.2 must carry,
per loser, `original_email` **exactly as stored** (case included, from A2's
`email` column), `original_is_active` (A2's `is_active` column), the `audit_id` A3
printed for that remediation, and the `survivor_id` A3 used. A mapping that says
"active" for a row that was already inactive is indistinguishable from a wrong
rollback — the guard is what makes that impossible to apply.

**Understand what A4 does *not* fix:** restoring the original address puts two rows
back on the same case-insensitive key, so the application returns to the fail-closed
`400 Email này đã được sử dụng` for that address — both accounts are locked out of
password login until the duplicate is resolved again. Run A4 only when the survivor
choice was wrong, and follow it immediately with a corrected A3 for the same group
(otherwise §3.4 will report a remaining duplicate group forever). If several groups
were processed incorrectly, restore the snapshot from §2 item 3 instead of replaying
partial rollbacks.

### 3.5.2 Why A4 needs the audit id, and who is allowed to own the address

**Finding 9 (fixed) — the old ownership guard could never pass.** A4 used to abort
if *any* row other than the loser held the normalized original address
(`id <> v_loser AND lower(email) = lower(v_original)`). A3 leaves that address with
the **survivor** on purpose — that is the point of remediation — so the guard
matched the survivor on every legitimate rollback and A4 could never restore
anything. The guard now derives the expected owner from the audit record instead of
assuming nobody may own it:

| Owner of `lower(original_email)` at A4 time | A4 behaviour |
|---|---|
| the survivor named by `metadata->>'survivor_id'` | **allowed** — after re-verifying that the row exists and still holds the key (step 4) |
| the quarantined loser | impossible: it holds `…+legacy-<id>@quarantine.invalid` until step 6 |
| any third account | `ABORT: … (normalized) is also owned by …; refusing to restore` |
| the survivor no longer exists / no longer holds the key | `ABORT: survivor … no longer exists` / `no longer owns …` — the group changed, so the plan is stale (re-run §3.1, or restore from the snapshot) |

Because `users.email` is unique (case-sensitive) and a duplicate pair differs in
stored case by construction, the restored `email` cannot collide with the survivor's
row; if it ever did, PostgreSQL's `23505` aborts the transaction with nothing
applied — fail closed, never a partial restore. A4 restores the loser only; revoked
refresh tokens stay revoked (step 6 does not touch `public.refresh_tokens`).

**Finding 10 (fixed) — "the latest audit row for this user" is not correlation.**
The old lookup filtered only on `action` / `entity_type` / `entity_id` and then took
`ORDER BY created_at DESC LIMIT 1`, so an `ADMIN_EMAIL_DEDUP` row belonging to a
*different group* of the same user could answer for the remediation being reversed,
and every corroboration check would then be validating the ticket against the wrong
event. A4 now takes the `audit_id` A3 printed and re-verifies, in this order:

1. `id = v_audit_id` **and** `action = 'ADMIN_EMAIL_DEDUP'` **and**
   `entity_type = 'User'` **and** `entity_id = v_loser` — the record the ticket
   names, for this user (a random or foreign id aborts);
2. `metadata->>'email_key' = v_group` — same normalized address;
3. `metadata->>'quarantine_address' = v_current.email` — the record is tied to the
   address the row actually holds now, not to one re-derived from the ticket;
4. `metadata->>'original_email'` and `metadata->>'original_is_active'` equal the
   ticket CSV — corroboration stays independent because only the id is part of the
   selection predicate, so a wrong ticket still fails;
5. `metadata->>'survivor_id'` is present, is not the loser, and that row still
   holds the key (the ownership table above).

A second remediation of the *same* group is the one case the id cannot distinguish,
and it does not need to: A3 derives the quarantine address from `(email_key, loser)`,
so re-remediating after a rollback writes an equivalent record, and either id
restores the same state (measured in §3.6). If the loser's `is_active` differed
between the two runs, the CSV-vs-record check in step 4 rejects the stale id.

Ordering: every ticket mistake that can be detected without the database fails
before `LOCK TABLE` is taken, and the ownership checks run **while** the `EXCLUSIVE`
lock is held, so no writer can claim the address between verification and restore.
This costs nothing in compatibility: no remediation has been executed (§ status:
DRAFT), so no audit row exists that predates the `survivor_id`/`audit_id` handshake.

### 3.6 Dry-run evidence (recorded for this review)

A3 and A4 were executed against the **test** database only, inside transactions that
were always rolled back (a throw-away probe, deleted afterwards), on PostgreSQL
17.11. Row counts were identical before and after this run — `users = 3`,
`refresh_tokens = 223`, `audit_logs = 179`, `0` synthetic rows left behind and
`0` duplicate groups — so nothing was persisted. The blocks were not retyped for the
test: they were **extracted from this file** and run verbatim (whole fenced blocks:
5,963 bytes for A3, 6,507 bytes for A4), with only the `BEGIN;` / `COMMIT;` wrapper
lines removed so the harness could own the transaction. For every round-trip case the
`audit_id` was read back from the row A3 wrote and fed to A4, i.e. the handshake
described in §3.5.2 was exercised end to end. Each abort case ran behind a
`SAVEPOINT` so the harness could prove, *inside the same transaction*, that `users`,
`refresh_tokens` and `audit_logs` were byte-identical after the failure
(`unchanged = true` in every row below).

**Current revision: 19 A4 scenarios, 19/19 behaved as specified**, plus two A3
regression checks (`audit_id` output, exact-set abort). The A3 guard matrix below was
verified in the previous run; A3's guard logic is unchanged apart from emitting
`v_audit_id`.

| Case | Plan supplied | Observed result |
|---|---|---|
| A3 happy path (loser active) | pair `Probe.Dup@…` / `probe.dup@…`, loser has 2 live + 1 revoked token | loser → `probe.dup@…+legacy-<id>@quarantine.invalid`, `is_active = false`; 3/3 of its tokens revoked (`revoked_refresh_tokens = 2` live ones); survivor untouched (`Probe.Dup@…`, still active, its 1 live token intact); 1 row left on the key; exactly 1 audit row carrying `email_key`, `survivor_id`, `quarantine_address`, `original_email`, `original_is_active = true`, whose 36-char `text` id is printed as `audit_id=…` (re-verified in this run) |
| A3 happy path (loser already inactive) | same pair, loser `is_active = false` | remediation succeeds identically; audit row records `original_is_active = false` |
| **A3 abort: extra third member** | approved `{S,L}`, a third row `PROBE.DUP@…` exists | `ABORT: group membership changed since inventory (…, extra={<C>}, missing={})`; no write |
| A3 abort: survivor id wrong (id substituted in *both* places) | `v_survivor` **and** one array slot replaced by a third user's id | `ABORT: group membership changed … extra={<original survivor>}, missing={<substituted id>}` — the exact-set assertion stops it although the plan is self-consistent; no write |
| A3 abort: loser id wrong (id substituted in *both* places) | same for `v_loser` | `ABORT: group membership changed … extra={<real loser>}, missing={<substituted id>}`; no write |
| A3 abort: survivor id outside approved set | `v_survivor` mistyped to another user, array unchanged | `ABORT: survivor <id> is not a member of the approved id set {…}`; no write |
| A3 abort: loser id outside approved set | `v_loser` mistyped to another user, array unchanged | `ABORT: loser <id> is not a member of the approved id set {…}`; no write |
| A3 abort: survivor = loser | both scalars set to the same id | `ABORT: survivor and loser are the same id (<id>)`; no write |
| A3 abort: missing member | one id replaced by a random UUID | `ABORT: group membership changed … extra={<real L>}, missing={<random>}`; no write |
| A3 abort: wrong pairing | two real users on different keys | `ABORT: group membership changed … extra={both group rows}, missing={both supplied ids}`; no write |
| A3 abort: unknown key | `email_key` that matches nothing | `ABORT: group membership changed … current={} …`; no write |
| **A4 happy path (originally active) — Finding 9 regression** | full A3 → A4 round trip in one transaction, A4 given the `audit_id` A3 printed, CSV `true` | survivor `Probe.Roundtrip@…` left owning the key; loser restored to `probe.roundtrip@…` with `is_active = true`; its 3 tokens stay revoked (0 live); 2 rows back on the key (the duplicate is restored on purpose); still exactly 1 audit row |
| A4 happy path (originally inactive) | same, loser seeded inactive, CSV `false` | restored `probe.roundtrip@…` with `is_active = false` (verbatim, not assumed); 0 live tokens |
| **A4 abort: audit id belongs to a different group (Finding 10)** | two groups remediated in one transaction; group 2's audit id supplied to A4 for group 1 | `ABORT: audit record <id> is not an ADMIN_EMAIL_DEDUP row of user <loser>`; `unchanged = true` |
| A4 accepts a re-remediation id — equivalence proven | A3 → A4 → A3 on the same loser; rollback with the **second** audit id | both records carry identical `email_key` / `quarantine_address` / `original_email` / `original_is_active` / `survivor_id`, and the restore reproduces the same state: a re-remediation of the same group is equivalent by construction, so no id can select a different outcome |
| A4 abort: stale record vs the current remediation | A3 → A4 → loser deactivated → A3; rollback with the **first** audit id, CSV `false` | `ABORT: audit record recorded original_is_active true, ticket says false`; `unchanged = true` |
| A4 abort: audit id is not a dedup record | random UUID | `ABORT: audit record <uuid> is not an ADMIN_EMAIL_DEDUP row of user <loser>`; `unchanged = true` |
| A4 abort: record describes another quarantine address | post-A3, `metadata.quarantine_address` altered | `ABORT: audit record <id> recorded quarantine address probe.superseded@…, but user <loser> holds probe.roundtrip@…+legacy-<id>@quarantine.invalid`; `unchanged = true` |
| A4 abort: CSV contradicts the record on `is_active` | loser was active, CSV says `false` | `ABORT: audit record recorded original_is_active true, ticket says false`; `unchanged = true` |
| A4 abort: `original_email` is not the stored case | CSV `PROBE.ROUNDTRIP@…` (same key) | `ABORT: audit record recorded original_email probe.roundtrip@…, ticket says PROBE.ROUNDTRIP@…`; `unchanged = true` |
| A4 abort: ticket cross-wired to another key | `original_email` from an unrelated address | `ABORT: original_email someone.else@… is not on key probe.roundtrip@… (ticket is cross-wired)`; `unchanged = true` |
| A4 abort: `original_is_active` not a boolean | `<original_is_active>` filled with `yes` | `ABORT: original_is_active must be literally true or false (got yes)`; `unchanged = true` |
| A4 abort: `<audit_id>` left empty | empty string | `ABORT: audit_id is missing — quote the id A3 printed for this remediation`; `unchanged = true` |
| **A4 abort: a third account claimed the freed address** | post-A3, `PROBE.ROUNDTRIP@…` inserted (a case variant the unique index allows) | `ABORT: probe.roundtrip@… (normalized) is also owned by <id> <PROBE.ROUNDTRIP@…>; refusing to restore`; `unchanged = true` |
| A4 abort: survivor renamed off the key | post-A3, survivor → `moved@example.invalid` | `ABORT: survivor <id> no longer owns probe.roundtrip@… (it now holds moved@example.invalid); refusing to restore into a changed group`; `unchanged = true` |
| A4 abort: survivor deleted | post-A3, `DELETE` the survivor | `ABORT: survivor <id> no longer exists; re-run §3.1 and restore from the snapshot instead`; `unchanged = true` |
| A4 abort: record carries no `survivor_id` | post-A3, `metadata - 'survivor_id'` | `ABORT: audit record <id> carries no survivor_id — ownership cannot be verified`; `unchanged = true` |
| A4 abort: record names the loser as survivor | post-A3, `metadata.survivor_id := loser` | `ABORT: audit record <id> names the loser as its own survivor`; `unchanged = true` |
| A4 abort: loser reactivated | post-A3, `is_active → true` | `ABORT: user <id> is active again (state changed after remediation)`; `unchanged = true` |
| A4 abort: loser never quarantined | post-A3, loser email put back to the original | `ABORT: current email probe.roundtrip@… is not the quarantine address … (state changed after remediation)`; `unchanged = true` |

In both happy paths the loser's revoked refresh tokens stayed revoked: A4 restores
`email` and `is_active` only and never touches `public.refresh_tokens`. The previous
shape of A4 could not pass either happy path — the old ownership guard matched the
survivor and aborted (§3.5.2, Finding 9) — which is why these rows are marked as a
regression.

Concurrency cases (the same probe, two sessions):

| Case | Setup | Observed result |
|---|---|---|
| Phantom insert is possible with row locks only | session 1: `SELECT id FROM users WHERE id = S FOR UPDATE`; session 2 inserts a **third** row with the same `lower(email)` | insert **succeeded in 744 ms** while the row lock was held → a row lock alone cannot protect the group |
| `EXCLUSIVE` blocks writers | session 1 holds `LOCK TABLE public.users IN EXCLUSIVE MODE NOWAIT`; session 2 inserts with `lock_timeout = 2 s` | `55P03 canceling statement due to lock timeout` → the writer is held for exactly as long as A3 runs |
| `EXCLUSIVE` does not block readers | same lock held; session 2 runs a plain `SELECT` | succeeded in 372 ms → read paths unaffected |
| A3 fails fast instead of queueing | same lock held; A3 with an unrelated plan | `55P03 could not obtain lock on relation` after 377 ms, no waiting → operator retries |
| A3 stops for a `FOR UPDATE` reader | session 1 holds `FOR UPDATE` on its own row; A3 runs | `55P03`, `unchanged = true`, fixture state identical → no deadlock, no partial work |

## 4. Item B — legacy password-hash inventory

### 4.1 Why it matters

`hasUsablePassword()` in `src/utils/email.ts` only accepts a canonical bcrypt
hash (`/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/`). Any other value — a plaintext
password, an MD5/SHA digest, an empty string — makes `login` fail closed with the
generic `401 Email hoặc mật khẩu không đúng`, while still spending one bcrypt
comparison (`DUMMY_PASSWORD_HASH`) so the response time does not leak account
state. Accounts created through Google intentionally carry the sentinel `!`
(`NO_PASSWORD`): that is **not** a defect and must not be "repaired".

### 4.2 Inventory (read-only)

The three statements use **dollar-quoted regex bodies** (`$rex$…$rex$`) and the
`\Z` end-of-string anchor. Reason: inside a plain `'…'` literal the meaning of
`\$` depends on `standard_conforming_strings`, and an operator can flip that
session setting (poolers, `SET`, older clients). Dollar quoting never processes
backslashes, so the pattern is byte-for-byte what you see. `\Z` is used instead of
a trailing `$` so the pattern does not end with the anchor character, which keeps
`$rex$` unambiguous. §4.5 records the verification.

```sql
-- B1: classify every stored credential
SELECT CASE
         WHEN password_hash IS NULL OR password_hash = ''  THEN 'empty'
         WHEN password_hash = '!'                           THEN 'google_only_sentinel'
         WHEN password_hash ~ $rex$^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}\Z$rex$
                                                            THEN 'bcrypt'
         WHEN password_hash ~ $rex$^\$2[aby]\$$rex$          THEN 'bcrypt_like_truncated'
         WHEN password_hash ~ $rex$^[0-9a-fA-F]{32}\Z$rex$   THEN 'md5_like'
         WHEN password_hash ~ $rex$^\$argon2$rex$            THEN 'argon2_like'
         ELSE 'other'
       END                                AS kind,
       count(*)                           AS users,
       count(*) FILTER (WHERE is_active)            AS active,
       count(*) FILTER (WHERE is_email_verified)    AS email_verified
FROM public.users
GROUP BY kind
ORDER BY users DESC;
```

```sql
-- B2: bcrypt cost distribution (anything below 10 is a legacy cost factor)
SELECT substring(password_hash from 5 for 2) AS cost, count(*) AS users
FROM public.users
WHERE password_hash ~ $rex$^\$2[aby]\$$rex$
GROUP BY cost
ORDER BY cost;
```

```sql
-- B3: per-user list for the accounts that cannot use password login at all
SELECT id, email, role, is_active, is_email_verified, created_at,
       left(coalesce(password_hash, '<null>'), 12) AS hash_prefix,
       length(coalesce(password_hash, ''))         AS hash_length
FROM public.users
WHERE password_hash IS NULL
   OR password_hash NOT LIKE '$2%'
   OR (password_hash <> '!'
       AND password_hash !~ $rex$^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}\Z$rex$)
ORDER BY created_at, id;
```

### 4.3 Interpretation and remediation (DRAFT — nothing to execute in bulk)

| `kind` | Meaning | Action |
|---|---|---|
| `bcrypt` (cost ≥ 10) | healthy | none |
| `google_only_sentinel` | Google-only account, by design | none — do **not** set a password |
| `bcrypt` with cost < 10 | works, but below current cost | no bulk rewrite possible (hashes are one-way); consider an opportunistic re-hash on next successful login as a **separate** follow-up (not part of this change) |
| `empty` / `other` / `md5_like` / `bcrypt_like_truncated` / `argon2_like` | credential unusable | user must go through `POST /api/v1/auth/forgot-password` → `reset-password` (that path writes a fresh `bcrypt` cost-10 hash) or sign in with Google (which claims an unverified account) |

Operational notes:

- There is **no** safe bulk migration: the server never sees the plaintext, so a
  "fix" is only possible per user through a reset flow. Never set a shared or
  default password, and never copy one user's hash to another.
- For `is_active = true` accounts with unusable hashes, contact the account
  owner out-of-band and point them at the reset flow; record who was notified in
  the change ticket.
- `resetPassword` revokes all live refresh tokens for that user in the same
  transaction, so a reset also closes existing sessions.
- Deactivating these accounts is **not** recommended as part of this runbook:
  it would lock out users who are only missing a credential format.

### 4.4 Verification

Re-run B1 after the outreach window; the `users` count for the unusable buckets
should only decrease as users reset. No database write is expected from this
item, so there is nothing to roll back.

### 4.5 Regex evidence (recorded for this review)

Two checks were run against the **test** database (read-only, PostgreSQL 17.11)
with a throw-away probe that has been deleted.

1. **Classification matrix.** Twelve credential shapes (real cost-10 and cost-4
   bcrypt hashes, a `$2y$12$` hash, the `!` sentinel, a truncated bcrypt hash, a
   `$2b$10$` prefix only, an MD5 hex digest, an Argon2id string, `''`, a plaintext
   password, `'   '`, `NULL`) were classified with the dollar-quoted form used
   above and with the previous single-quoted form, once with
   `standard_conforming_strings = on` and once with it `off` (set `LOCAL` inside a
   transaction that was rolled back). **All 12 shapes produced identical
   `kind` and `cost` in all four combinations**, e.g. `bcrypt`/`10` for the real
   cost-10 hash, `bcrypt_like_truncated`/`10` for the truncated one,
   `google_only_sentinel`/`null` for `!`, `md5_like`/`null`, `argon2_like`/`null`,
   `empty` for `''` and `NULL`, `other` for plaintext and spaces.
   (`\Z` is used instead of `\z`: PostgreSQL's ARE engine rejects `\z` with
   `2201B invalid escape \ sequence` — verified, and the reason the doc uses `\Z`.)
2. **The documented text itself.** B1, B2 and B3 were extracted from this file and
   executed verbatim against `public.users`: B1 returned a single
   `bcrypt / users=3 / active=3 / email_verified=3` row, B2 returned
   `cost=10 / users=3`, and B3 returned no rows — i.e. the statements parse, use
   the intended schema, and classify correctly. The `public.` prefix is not
   cosmetic: the same column references against the Supabase GoTrue tables of the
   same name fail with `42703 column "password_hash" does not exist` /
   `42703 column "is_active" does not exist`, and joining
   `auth.refresh_tokens` to `auth.users` fails with
   `42883 operator does not exist: uuid = character varying` (all three verified).
   A narrower statement such as `SELECT count(*) FROM users` has no such signal —
   it silently counts whichever `users` the session's `search_path` resolves to.

## 5. Item C — live refresh tokens of inactive users

### 5.1 Why it matters

`adminService.updateUserStatus` now flips `is_active` **and** revokes
`public.refresh_tokens` in one transaction, so every deactivation performed after
this deploy is clean. Rows that predate the deploy can still be
`revoked_at IS NULL` for deactivated accounts. Rotation already rejects them:
`refresh` re-reads the user row after taking the `users` lock and refuses inactive
accounts. So this item is hygiene, not an active vulnerability.

Two residuals remain. Both are tracked as H-04 and are **out of scope** here, and
the wording matters because they are easy to mis-state:

| Residual | Actual behaviour (verified in code) |
|---|---|
| Access token already issued | A stateless JWT, valid until its `expiresAt` (15 min). Logout, password reset and deactivation do **not** revoke it. However every HTTP request passes through `authenticate` / `authenticateOptional`, which re-read `public.users.is_active`, so such a token already receives `401 Tài khoản không tồn tại hoặc đã bị khóa` on the next request. |
| Socket.IO connections | `isActive` is checked **only in the connection handshake** — `io.use(...)` in `src/socket/index.ts` does one `prisma.user.findUnique({ select: { isActive: true } })` per connection. An **already-open** socket is *not* forcibly disconnected on deactivation and is *not* re-checked per event, so it keeps receiving its rooms' events (`send_message` included) until the client disconnects. A **new or reconnecting** handshake with the same token *is* rejected, because the handshake re-reads `is_active`. |

Consequently, revoking an inactive user's refresh tokens (C4) does **not** close an
already-open socket; it only stops new access/refresh tokens from being derived from
that session. Forcing live sockets closed is a separate H-04 change.

### 5.2 Inventory (read-only)

```sql
-- C1: how many "live" tokens belong to deactivated accounts
SELECT count(*)                       AS live_tokens,
       count(DISTINCT rt.user_id)     AS affected_users,
       min(rt.created_at)             AS oldest,
       max(rt.created_at)             AS newest
FROM public.refresh_tokens rt
JOIN public.users u ON u.id = rt.user_id
WHERE u.is_active = false
  AND rt.revoked_at IS NULL;
```

```sql
-- C2: per-user detail (use this to sanity-check before revoking)
SELECT rt.user_id, u.email, u.updated_at AS deactivated_at,
       count(*) FILTER (WHERE rt.revoked_at IS NULL) AS live_tokens,
       max(rt.expires_at)                            AS latest_expiry
FROM public.refresh_tokens rt
JOIN public.users u ON u.id = rt.user_id
WHERE u.is_active = false
GROUP BY rt.user_id, u.email, u.updated_at
HAVING count(*) FILTER (WHERE rt.revoked_at IS NULL) > 0
ORDER BY live_tokens DESC;
```

```sql
-- C3: expired-but-not-revoked rows overall (informational; housekeeping candidate)
SELECT count(*) AS expired_unrevoked
FROM public.refresh_tokens
WHERE revoked_at IS NULL AND expires_at <= now();
```

### 5.3 Remediation (DRAFT — DO NOT RUN WITHOUT APPROVAL)

Idempotent, chunked, single-table update. `logout` also touches only
`refresh_tokens`, so this statement cannot create a lock cycle with
`issueSession` / `refresh` / `deactivate` (which all take `users` first).

```sql
-- C4: revoke in chunks of 5000 until the statement reports 0 rows
WITH victims AS (
  SELECT rt.id
  FROM public.refresh_tokens rt
  JOIN public.users u ON u.id = rt.user_id
  WHERE u.is_active = false
    AND rt.revoked_at IS NULL
  LIMIT 5000
)
UPDATE public.refresh_tokens rt
SET revoked_at = now()
FROM victims v
WHERE rt.id = v.id
  AND rt.revoked_at IS NULL;
```

Repeat C4 until `UPDATE 0`, then verify with §5.4. Record the row counts per
chunk in the change ticket.

### 5.4 Verification (read-only)

```sql
SELECT count(*) AS remaining_live_tokens_of_inactive_users
FROM public.refresh_tokens rt
JOIN public.users u ON u.id = rt.user_id
WHERE u.is_active = false AND rt.revoked_at IS NULL;
-- expect 0
```

Functional check: pick one deactivated fixture account, call
`POST /api/v1/auth/refresh` with any previously captured refresh token and expect
`401 Refresh token không hợp lệ hoặc đã hết hạn`.

Socket check (expect the *documented* behaviour, not a disconnect): with a socket
opened **before** the account was deactivated, a reconnect attempt is rejected with
`Authentication error: User is inactive`, while the already-open connection stays
usable until the client closes it (§5.1, H-04). Record both observations in the
ticket so the residual is an explicit, agreed acceptance rather than a surprise.

### 5.5 Rollback

None needed and none recommended: revocation is the safe direction, and
un-revoking tokens would re-enable sessions that were suspended for a reason.
Only a snapshot restore (if the wrong predicate was used) can undo it.

## 6. Post-deploy verification (application, not database)

| # | Check | Expected |
|---|---|---|
| 1 | `npx tsc --noEmit` on the deployed commit | exit 0 |
| 2 | `npm run build` | exit 0, `dist/server.js` produced |
| 3 | `POST /api/v1/auth/login` (verified active user, correct password) | `200`, access + refresh token |
| 4 | `POST /api/v1/auth/login` (wrong password) | `401 Email hoặc mật khẩu không đúng` |
| 5 | `POST /api/v1/auth/login` (deactivated user, correct password) | `401 Email hoặc mật khẩu không đúng` (anti-enumeration, **not** 403) |
| 6 | `POST /api/v1/auth/login` (Google-only account `password_hash = '!'`) | `401 Email hoặc mật khẩu không đúng` |
| 7 | `POST /api/v1/auth/register` with an existing address (any casing) | `400 Email này đã được sử dụng` |
| 8 | `POST /api/v1/auth/login` for an address with duplicate rows | `400 Email này đã được sử dụng` (fails closed; §3 removes it) |
| 9 | Admin deactivates a user → that user's `POST /auth/refresh`, then `GET /api/v1/auth/me` with the still-valid access token | refresh `401`; `/me` `401 Tài khoản không tồn tại hoặc đã bị khóa` (the middleware re-reads the row, so deactivation is immediate) |
| 10 | `GET /api/v1/auth/google` (302 to Google) → `GET /api/v1/auth/google/callback` with a Google test account | callback redirects to `${FRONTEND_URL}/login#google=token=…&refreshToken=…`; a brand-new Google account is created with `password_hash = '!'`; a failure redirects to `/login?googleError=1` |
| 11 | Error-rate dashboards for `POST /auth/login`, `/auth/refresh` | no new `500`s; watch for `P2028` (§9) |
| 12 | Socket.IO reconnect for a deactivated user (browser devtools or a small client) | rejected: `Authentication error: User is inactive`; an already-open socket stays connected until the client closes it (H-04, §5.1) |

## 7. Application rollback

The change adds no schema objects and no migrations, so rolling back is a code
rollback only:

1. Redeploy the previous image/commit.
2. No database statement needs to be reverted. Data touched by §3 and §5 stays
   valid for the old code as well (a quarantined email is just an email, a
   revoked token is ignored).
3. Restart the app, then re-run checks 3–7 of §6.
4. Do **not** run `prisma db push` or add migrations to "fix" a rollback.

## 8. Build, test and evidence baseline (for the change ticket)

Recorded on the change that introduced this runbook:

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run build` (`tsc` → `dist/`) | exit 0 |
| `npx vitest run` on the 6 auth-related files (`src/auth.integration.test.ts`, `src/services/auth.google.test.ts`, `src/services/auth.session.test.ts`, `src/services/auth.session.db.test.ts`, `src/services/admin.users.test.ts`, `src/utils/prisma-errors.test.ts`) | 6 files / 53 tests passed |
| `npx vitest run src/services/auth.session.db.test.ts` (needs the test database) | 11 tests passed |
| `node scripts/run-tests.js` (whole suite) | `Test Files 1 failed \| 9 passed (10)`, `Tests 59 passed \| 1 skipped (60)` — the single failure is the pre-existing `src/matching.integration.test.ts` above (duration 98 s) |

Runbook dry-run evidence for this revision: §3.6 (19 A4 cases after the Findings 9/10
rewrite — every happy path and every abort guard — plus A3's guard matrix and 5
two-session concurrency cases, all on rolled-back transactions) and §4.5 (B1/B2/B3
classification matrix). Additionally,
**every SQL block in this document was extracted from the file and executed**
against the test database: A3/A4 verbatim inside rolled-back transactions, and the
10 standalone read-only statements (A1, A2, B1, B2, B3, C1, C2, C3, §3.4, §5.4)
with no errors — the §3.2 `ORDER BY` snippet is a fragment by design and is labelled
as such — plus the §5.3 `C4` chunked revoke, which parsed and affected 0 rows (a
no-op on the current data, run inside a rolled-back transaction). All temporary probes
were deleted after the run; the test database ended
unchanged (`users = 3`, `refresh_tokens = 213`, `audit_logs = 171`, no duplicate
groups, no quarantined rows, no live tokens for inactive users, no `probe`/`batch4`/
`auth.session`/`matching-` fixture rows).

Re-running the read-only verification blocks after the dry-run confirmed the cleanup:
§3.4 returned `remaining_duplicate_groups = 0` / `quarantined_rows = 0`, and §5.4
returned `remaining_live_tokens_of_inactive_users = 0`, matching the fixture inventory
(`users = 3`, `refresh_tokens = 213`, `audit_logs = 171`).

## 9. Known failures and remaining risks (accepted, not fixed here)

| # | Item | Impact |
|---|---|---|
| 1 | **`src/matching.integration.test.ts` fails in this environment** — `The column 'roommate_preferences.has_room' does not exist in the current database` | Pre-existing test-database schema mismatch: `prisma/schema.prisma:606` declares `hasRoom @map("has_room")` (last changed in `02d865d`, before this work) while the test database predates that column. `prisma/migrations` is empty, so the project relies on `prisma db push`. Fixing it requires a schema sync, which is **out of scope** for this change. |
| 2 | Deadlock cycle between `verifyEmail` and `sendEmailVerification` (email verification codes) | Unchanged by this work; the session paths avoid it, but the verification flow can still deadlock under contention. |
| 3 | Lock wait vs the 5 s interactive-transaction timeout | Heavy contention on one `users` row can surface as `P2028` → `500`. No retry is implemented; the code deliberately fails closed instead of granting a session. |
| 4 | No deadlock retry | `P2034` propagates as-is (tested); the client sees `500`. |
| 5 | Access tokens are stateless (15 min) and are not revoked by logout/password reset (H-04) | HTTP is fine: `authenticate`/`authenticateOptional` re-read `users.is_active`, so a deactivated account is refused on its next request. The residual is (a) a still-valid token after logout/reset, and (b) Socket.IO, where `is_active` is checked **only in the handshake** (`src/socket/index.ts`): an already-open socket is not force-disconnected and not re-checked per event. Out of scope; described in §5.1 and observable via §6 check 12. |
| 6 | Ambiguity `400` reveals that the address exists | Accepted trade-off of failing closed on duplicate rows; §3 removes the condition. |
| 7 | Google-only accounts carry `password_hash = '!'` | By design; password login fails closed. Inventory in §4 must not "repair" these. |

## 10. Approval checklist (fill in before execution)

| Gate | Owner | Evidence |
|---|---|---|
| Code review of the deployed commit | backend lead | PR link / diff against `890037b` (current `master` at preparation time) |
| Snapshot / PITR marker created | DBA | snapshot id |
| §3.1 / §4.2 / §5.2 inventories exported and attached | DBA | CSV names |
| Rollback mapping complete: per loser `original_email` **as stored**, `original_is_active`, plus the `audit_id` A3 printed and its `survivor_id` | DBA | CSV columns present (§3.1, §3.2, §3.5, §3.5.2) |
| Every A3 run's printed `audit_id` copied into the ticket row before the next group starts | DBA | ticket rows populated (§3.3, §3.5.2) |
| Duplicate-email survivor decisions recorded | product owner | ticket |
| Change window + on-call confirmed | ops | calendar |
| §3.3.1 reviewed: `LOCK TABLE … EXCLUSIVE NOWAIT` semantics accepted; registration quiesced if policy requires zero writer blocking | backend lead + ops | ticket note |
| Post-deploy checks 1–12 (§6) executed | ops | checklist |
| Explicit "runbook executed" sign-off | DBA + backend lead | ticket |
