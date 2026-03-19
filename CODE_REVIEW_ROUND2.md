# Code Review — Round 2 (Post-Fix Audit)
Date: 2026-03-19

---

## Verification Results

### RLS Policies

- [PASS] 9 policies confirmed in `pg_policies` — all 9 tenant-scoped tables have `tenant_isolation` policies covering ALL commands.
- [PASS] Policy USING expression is correct: `"tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')` — the `true` flag makes the setting missing (no tenant set) return NULL rather than throwing an error.
- [PASS] `relrowsecurity = t` on all 9 tables — RLS is enabled.
- [PASS] `relforcerowsecurity = t` on 8 of 9 tables — bypasses are blocked even for the table owner role (see critical finding below re: User table).
- [PASS] RLS functional isolation confirmed: with a non-superuser role, `SET app.current_tenant_id = '<hawassa-id>'` returns 0 students; `SET app.current_tenant_id = '<addis-id>'` returns 30 students. Isolation is working correctly at the PostgreSQL policy level.
- [PASS] `setRLSContext` middleware uses `set_config('app.current_tenant_id', $1, false)` with `false` (session-scoped, not transaction-scoped). This is correct for connection-pool use where Prisma manages connection lifetimes.
- [PASS] `index.ts` middleware chain `[authenticate, resolveTenant, setRLSContext]` is applied to all 6 protected route groups. Auth routes are correctly excluded.

### Backend Fixes

- [PASS] CRIT-003: `encryptRfid` / `decryptRfid` using AES-256-GCM with random 96-bit IV and 128-bit auth tag. `isEncryptedRfid` helper included for migration-period detection.
- [PASS] CRIT-004: File upload validation implemented — `photoUpload` (5 MB, JPEG/PNG/WebP only), `documentUpload` (10 MB, images + PDF + DOCX), `csvUpload` (2 MB, CSV only). All three multer instances have both `limits` and `fileFilter`.
- [PASS] CRIT-005: Student delete uses `prisma.student.update({ data: { status: 'INACTIVE' } })` — referential integrity of attendance, exam result, and fee records is preserved.

### Frontend Fixes

- [PASS] No raw `data?.data?.data` chains found anywhere in `src/pages/`. All pages use `unwrapList<T>()` from `@/lib/api-helpers`.
- [PASS] All three `<input>` elements found in pages are `type="file"` with `className="hidden"` — these are the standard pattern for custom file upload triggers, not disallowed form inputs.
- [PASS] Badge `success`, `info`, `amber`, `warning`, and `purple` variants all exist with correct light/dark Tailwind classes matching the design system spec.
- [PARTIAL — minor] Hardcoded placeholder strings (see Remaining Issues below).

---

## Remaining Issues

### CRIT (must fix before production) — 1 issue

**CRIT-NEW-01: The Prisma DB user is a PostgreSQL superuser — RLS is bypassed in production**

File: `packages/backend/prisma/migrations/20260319120000_add_rls_policies/migration.sql`
Database: `pg_user` shows `schoolsync` has `usesuper = t` AND `usebypassrls = t`.

PostgreSQL documentation is explicit: superusers bypass all RLS policies regardless of `FORCE ROW LEVEL SECURITY`. The `FORCE ROW LEVEL SECURITY` flag on 8 tables only prevents the *table owner role* (when not a superuser) from bypassing. A superuser always bypasses.

**Evidence:**
```sql
-- With NO tenant context set, the superuser sees all 30 students:
RESET app.current_tenant_id;
SELECT COUNT(*) FROM "Student";  -- returns 30 (should return 0)

-- With a non-superuser role, isolation works correctly:
SET ROLE schoolsync_app;
SET app.current_tenant_id = '<hawassa-id>';
SELECT COUNT(*) FROM "Student";  -- returns 0 (correct)
```

The isolation "test" in the audit instructions used the superuser `schoolsync`, which appeared to pass only because hawassa-academy has 0 students in seed data. If hawassa had any students, the test would have returned them all regardless of which tenant ID was set — demonstrating complete RLS bypass.

**Required fix:** Create a least-privilege application user and use it for all Prisma connections:
```sql
-- In a new migration or init script:
CREATE ROLE schoolsync_app_user LOGIN PASSWORD '<strong-password>';
GRANT CONNECT ON DATABASE schoolsync_dev TO schoolsync_app_user;
GRANT USAGE ON SCHEMA public TO schoolsync_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO schoolsync_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO schoolsync_app_user;
-- Do NOT grant SUPERUSER. Do NOT grant BYPASSRLS.
```
Then set `DATABASE_URL` in `.env` to use `schoolsync_app_user` for the API server. Keep a separate superuser-level connection only for running Prisma migrations (CI/CD only, not the live app).

---

### HIGH (fix before first client demo) — 2 issues

**HIGH-01: `User` table missing `FORCE ROW LEVEL SECURITY`**

`pg_class` shows `relforcerowsecurity = f` for the `User` table, while all other 8 tenant-scoped tables have `relforcerowsecurity = t`.

File: `packages/backend/prisma/migrations/20260319120000_add_rls_policies/migration.sql`

The migration enables RLS on `User` but does not add `ALTER TABLE "User" FORCE ROW LEVEL SECURITY`. The table owner can bypass the tenant isolation policy on the User table. Add to the migration:
```sql
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
```

**HIGH-02: `RFID_ENCRYPTION_KEY` is a placeholder value in `.env`**

File: `packages/backend/.env`, line containing `RFID_ENCRYPTION_KEY`

The key is set to `0000000000000000000000000000000000000000000000000000000000000001` — a trivially weak, all-zeros-plus-one value. The `crypto.ts` utility only validates that the key is a 64-character hex string; it does not reject weak or known-placeholder keys. Any RFID card numbers encrypted with this key provide zero real-world security.

This is a `.env` configuration issue, not a code issue — the code itself is correct. However, the file comment says "TODO: replace this placeholder before running the app" and it has not been replaced. This must be rotated to a cryptographically random value before any real RFID data is stored.

Generate a proper key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

### LOW (polish / i18n) — 1 issue

**LOW-01: Hardcoded placeholder strings not run through `t()`**

The following `placeholder` prop values are hardcoded English strings rather than i18n keys. They will not translate when the user switches to Amharic.

| File | Line | Hardcoded string |
|------|------|-----------------|
| `packages/frontend/src/pages/students/StudentDetailPage.tsx` | 227 | `placeholder="e.g. Birth Certificate"` |
| `packages/frontend/src/pages/students/StudentFormPage.tsx` | 299 | `placeholder="e.g. A+"` |
| `packages/frontend/src/pages/academic/ClassFormDialog.tsx` | 154 | `placeholder="Grade 1"` |
| `packages/frontend/src/pages/academic/SectionFormDialog.tsx` | 156 | `placeholder="A"` |
| `packages/frontend/src/pages/academic/SubjectFormDialog.tsx` | 174 | `placeholder="Mathematics"` |
| `packages/frontend/src/pages/academic/SubjectFormDialog.tsx` | 212 | `placeholder="MATH-01"` |

These are low-severity (placeholders disappear once the user types; they do not block functionality) but violate the project rule: "All user-facing strings must go through i18n, never hardcode English."

---

## New Issues Found

**NOTE-01: `set_config` third argument `false` (session scope) — connection pool risk**

File: `packages/backend/src/middleware/rls.ts`, line 21

```typescript
`SELECT set_config('app.current_tenant_id', $1, false)`
```

The `false` argument sets the config at **session scope** (persists for the database connection lifetime). Prisma uses a connection pool. If a connection is reused from the pool for a request from a different tenant — and `setRLSContext` is somehow not called (e.g., middleware short-circuits due to an error before reaching it) — the previous tenant's ID could leak into the next request.

The safer option is `true` (transaction scope), which resets the setting when the transaction ends. However, Prisma does not wrap every query in an explicit transaction by default, so transaction-scoped `set_config` would reset immediately after the `SELECT set_config(...)` call itself.

The correct production pattern is to use `$executeRaw` inside `prisma.$transaction` for every tenant-scoped query, or use Prisma's `$extends` client extensions to inject the tenant context per-client. This is a known Prisma + RLS integration challenge. The current implementation is the standard approach but carries the pool-reuse risk described above. This is worth documenting as a known limitation until a transaction-scoped solution is implemented.

This does not rise to CRIT given the current development stage, but it must be resolved before multi-tenant production load.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRIT (new) | 1 | RLS bypassed in production — Prisma DB user is a PostgreSQL superuser |
| HIGH | 2 | User table missing FORCE RLS; RFID key is placeholder |
| LOW | 1 | 6 hardcoded placeholder strings not i18n'd |
| PASS | All previously reported items | Fixed correctly |

The most significant finding is that the RLS implementation, while structurally correct (policies exist, USING expressions are right, middleware is wired), is **entirely bypassed in the running application** because the Prisma database user has `SUPERUSER` privileges. This must be addressed before any multi-tenant data is written to the system.
