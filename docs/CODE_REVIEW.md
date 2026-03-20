# SchoolSync Code Review
Date: 2026-03-19
Reviewer: Claude Sonnet 4.6
Scope: `packages/backend/src`, `packages/backend/prisma/migrations`, `packages/frontend/src`

---

## CRITICAL (Security vulnerabilities, data leaks, crashes)

### [CRIT-001] No RLS Policies in Any Database Migration
- **File**: `packages/backend/prisma/migrations/20260319093819_init/migration.sql`, `packages/backend/prisma/migrations/20260319103924_phase2_academic_students/migration.sql`
- **Issue**: Neither migration file contains a single `ENABLE ROW LEVEL SECURITY` or `CREATE POLICY` statement. Every tenant-scoped table — `User`, `AcademicYear`, `Class`, `Section`, `Subject`, `ClassSubject`, `Student`, `ParentStudent`, `StudentDocument` — has zero RLS policies. The database-level multi-tenant isolation advertised in the architecture **does not exist**. If Prisma's connection pool reuses a connection whose `app.current_tenant_id` session variable was set by a prior request, queries from a different tenant could read that tenant's data. Any bug that omits `tenantId` from a `where` clause leaks cross-tenant data with no DB-level safety net.
- **Fix**: Add for every tenant-scoped table:
  ```sql
  ALTER TABLE "TableName" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON "TableName"
    USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));
  ```

### [CRIT-002] `setRLSContext` Middleware Is Defined but Never Applied Anywhere
- **File**: `packages/backend/src/index.ts` (lines 53–59), `packages/backend/src/middleware/rls.ts`
- **Issue**: `setRLSContext` is defined in `rls.ts` but is never imported or applied in `index.ts` or any route file. `resolveTenant` is only applied to `POST /auth/login` (in `auth.routes.ts`). No other route populates `req.tenant`, so `setRLSContext` would always short-circuit on `if (!req.tenant) return next()`. Even if CRIT-001 were fixed, RLS policies would never fire at runtime because the PostgreSQL session variable `app.current_tenant_id` is never set.
- **Fix**: Apply `resolveTenant` + `setRLSContext` as global middleware in `index.ts` before all API routes, or add them to each module router.

### [CRIT-003] RFID Card Numbers Stored as Plaintext
- **File**: `packages/backend/prisma/schema.prisma` (`rfidCardNumber String?`), `packages/backend/src/modules/student/student.service.ts` (lines 25–37, 150, 185)
- **Issue**: `rfidCardNumber` is stored in plain text with a plain-text index. CLAUDE.md Security Checklist states "RFID card numbers encrypted at rest." The service reads, writes, and compares them as raw strings. An attacker with database read access could map every card number to a student's physical identity, enabling tracking of children.
- **Fix**: Encrypt RFID card numbers using AES-256-GCM (via `src/utils/crypto.ts`). Store a HMAC-SHA256 of the card number in a separate lookup column. The lookup column is used for uniqueness checks; the encrypted column stores the actual value for display.

### [CRIT-004] File Uploads Have Zero Type or Size Validation
- **File**: `packages/backend/src/modules/student/student.routes.ts` (line 16)
- **Issue**: `multer({ dest: 'uploads/' })` is used for photo upload, document upload, and bulk CSV import with no `fileFilter` and no `limits`. An attacker can upload a 1 GB file to exhaust disk space, or upload executable files (`.php`, `.sh`) to the server's `uploads/` directory. If `uploads/` is web-accessible, a stored XSS/SSRF via SVG upload is possible.
- **Fix**: Add `fileFilter` restricting photos to `image/jpeg|png|webp`, documents to a PDF/Word/image allowlist, and CSV imports to `text/csv`. Add `limits: { fileSize: 5 * 1024 * 1024 }`. Upload to S3/MinIO as the architecture specifies — not to local disk.

### [CRIT-005] Student Delete Is a Hard Delete, Not a Soft Delete
- **File**: `packages/backend/src/modules/student/student.service.ts` (line 204)
- **Issue**: `studentService.delete` calls `prisma.student.delete({ where: { id } })`, permanently destroying the row. This cascades to `ParentStudent` and `StudentDocument` and will break foreign key references in attendance, exam results, and fee records when those modules are added. CLAUDE.md requires soft delete via `status = 'INACTIVE'`.
- **Fix**: Replace with `prisma.student.update({ where: { id }, data: { status: 'INACTIVE' } })`.

---

## HIGH (Bugs, missing validations, broken features)

### [HIGH-001] RFID Uniqueness Check Is Not Tenant-Scoped — Cross-Tenant Data Leakage
- **File**: `packages/backend/src/modules/student/student.service.ts` (lines 25–37, 377–383)
- **Issue**: `checkRfidUniqueness` and the bulk import RFID check query `prisma.student.findFirst({ where: { rfidCardNumber } })` with no `tenantId` filter. The error message `RFID card number 'XXXXX' is already assigned to another student` confirms card assignment across tenants — revealing data from School B to School A's admin.
- **Fix**: Add `tenantId` to both RFID queries. Change the error message to not echo back the card number value.

### [HIGH-002] All Prisma Write Operations Scope by `id` Only — Missing Tenant Guard in Writes
- **File**: `packages/backend/src/modules/student/student.service.ts` (lines 173, 213), and all other service files
- **Issue**: `prisma.student.update({ where: { id }, data: {...} })` — only `id` in the write's `where` clause. The tenant check is a prior `findFirst`, creating a TOCTOU gap. If the prior check is removed or has a bug, updates execute cross-tenant.
- **Fix**: Use `where: { id, tenantId }` in all `update`, `delete`, and `updateMany` operations.

### [HIGH-003] `bulkCreate` Admission Number Generation Has a Race Condition
- **File**: `packages/backend/src/modules/student/student.service.ts` (lines 338, 386–387)
- **Issue**: `prisma.student.count({ where: { tenantId } })` is called once, then local counter increments. Two concurrent bulk imports for the same tenant will read the same `baseCount` and generate identical admission numbers. `createMany(..., skipDuplicates: true)` will silently discard records without surfacing errors.
- **Fix**: Generate admission numbers inside a serializable transaction, or use a PostgreSQL sequence per tenant.

### [HIGH-004] `resolveTenant` Only Applied to Login — All Authenticated Routes Lack Tenant Resolution
- **File**: `packages/backend/src/modules/auth/auth.routes.ts` (line 11), all other route files
- **Issue**: `resolveTenant` only runs on `POST /auth/login`. No other route populates `req.tenant`. This means `setRLSContext` (which reads `req.tenant`) can never set the PostgreSQL session variable on any protected route, even if applied globally.
- **Fix**: Apply `resolveTenant` (lookup tenant from `req.auth.tenantId`) as global middleware on all authenticated routes.

### [HIGH-005] Raw `<input type="checkbox">` in StudentDetailPage — Violates Component Rules
- **File**: `packages/frontend/src/pages/students/StudentDetailPage.tsx` (lines 367–373)
- **Issue**: A raw HTML `<input type="checkbox">` is used for "isPrimary" in the assign-parent dialog. CLAUDE.md: "NEVER use raw HTML `<input>` — always shadcn wrappers." The shadcn `Checkbox` component exists in the project.
- **Fix**: Replace with `<Checkbox id="isPrimary" checked={isPrimary} onCheckedChange={(checked) => setIsPrimary(!!checked)} />`.

### [HIGH-006] Hardcoded English Strings Throughout Frontend — i18n Not Used
- **Files**:
  - `pages/dashboard/DashboardPage.tsx`: `'Total Students'`, `'Total Staff'`, `'Attendance %'`, `'Fee Collection %'`
  - `pages/academic/AcademicYearListPage.tsx`: `'Academic year deleted'`, `'Status'`, `'Archived'`, `'No academic years found...'`
  - `pages/academic/ClassListPage.tsx`: `'Class deleted'`, `'All Academic Years'`, `'No classes found...'`
  - `pages/academic/SectionListPage.tsx`: `'Section deleted'`, `'All Classes'`, `'No sections found...'`
  - `pages/academic/SubjectListPage.tsx`: `'Subject deleted'`, `'All Academic Years'`, `'All Types'`
  - `pages/students/BulkImportPage.tsx`: long instruction paragraph (~line 101)
  - `pages/students/StudentDetailPage.tsx`: `'Parent ID'`, `'Father'`, `'Mother'`, `'Guardian'`
- **Issue**: CLAUDE.md rule 5 + anti-patterns checklist item: all user-facing strings must go through `t()`. These will not translate to Amharic.
- **Fix**: Move all strings to `en.json` / `am.json` and replace with `t('key')` calls.

### [HIGH-007] Document Upload Dialog Uses Wrong i18n Key — Shows "Admission Number" as Label
- **File**: `packages/frontend/src/pages/students/StudentDetailPage.tsx` (~line 222)
- **Issue**: `<Label>{t('students.admission_number')}</Label>` is used as the label for the document name input field (whose placeholder is `'e.g. Birth Certificate'`). This is a copy-paste bug that renders "Admission Number" as the label in a document upload dialog.
- **Fix**: Replace with `t('students.document_name')` and add that key to `en.json` / `am.json`.

---

## MEDIUM (Code quality, missing best practices)

### [MED-001] Tenant Slug Echoed Back in Error Message — Tenant Enumeration Possible
- **File**: `packages/backend/src/middleware/tenant.ts` (~line 50)
- **Issue**: Error message `Tenant '${tenantSlug}' not found` echoes the user-supplied value. An attacker can enumerate valid tenant slugs by probing the login endpoint with `X-Tenant-ID` headers.
- **Fix**: Return `'Tenant not found'` without echoing the input.

### [MED-002] Academic Year Controller Re-Parses Query Params Manually Instead of Using Validated Data
- **File**: `packages/backend/src/modules/academic-year/academic-year.controller.ts` (lines 7–11)
- **Issue**: The controller manually extracts `page` and `limit` from `req.query` as strings and re-casts with `Number()`, bypassing the already-validated `req.query` from the `validate(paginationSchema, 'query')` middleware. Inconsistent with all other controllers.
- **Fix**: Pass `req.query` directly to the service, consistent with `student.controller.ts`.

### [MED-003] Academic Year Field in StudentFormPage Uses Raw `<label>` — Violates Component Rules
- **File**: `packages/frontend/src/pages/students/StudentFormPage.tsx` (line 315)
- **Issue**: A lowercase `<label>` HTML element is used after the FormField fix. CLAUDE.md requires the shadcn `<Label>` component. `academicYearId` also remains in the Zod schema but is destructured away before submission — confusing and wasteful.
- **Fix**: Replace `<label>` with shadcn `<Label>`. Remove `academicYearId` from the Zod schema entirely since it is not submitted.

### [MED-004] Weak Date Validation in StudentFormPage — Any Non-Empty String Passes
- **File**: `packages/frontend/src/pages/students/StudentFormPage.tsx` (lines 37–38)
- **Issue**: `dateOfBirth` and `admissionDate` are validated as `z.string().min(1)` only. `"not-a-date"` passes validation. Backend `studentService.create` does `new Date(dto.dateOfBirth)` without an `isNaN` guard, silently storing `Invalid Date`. (`bulkCreate` correctly validates with `isNaN(Date.parse(...))` but single-create does not.)
- **Fix**: Use `z.string().date()` on the frontend. Add `isNaN(Date.parse(dto.dateOfBirth))` guard in `studentService.create`.

### [MED-005] RFID Card Number Echoed in Conflict Error Message
- **File**: `packages/backend/src/modules/student/student.service.ts` (line 35)
- **Issue**: Error `RFID card number '${rfidCardNumber}' is already assigned to another student` echoes the physical card number in API responses — minor information disclosure.
- **Fix**: `'RFID card number is already assigned to another student'` (no card value in message).

### [MED-006] Triple-Nested Optional Chaining for API Responses Is Fragile and Inconsistent
- **File**: `packages/frontend/src/pages/students/StudentListPage.tsx` (lines 85–87), `ClassListPage.tsx` (lines 48, 61–62), `SectionListPage.tsx` (lines 48, 61–62), `AcademicYearListPage.tsx` (lines 48–49), `SubjectListPage.tsx` (lines 58, 72–73)
- **Issue**: `data?.data?.data?.data ?? []` and `data?.data?.data?.meta?.totalPages ?? 1` — the quadruple-nested optional chain reflects Axios `.data` → `ApiResponse.data` → `PaginatedResponse.data`. Silent fallback to `[]` masks response shape bugs. Now fixed to the correct 4-level chain, but the underlying structural issue remains.
- **Fix**: Define typed response wrappers and use React Query's `select` option to normalize response shape once at the query layer.

### [MED-007] Wrong Empty-State i18n Keys in StudentDetailPage Tabs
- **File**: `packages/frontend/src/pages/students/StudentDetailPage.tsx` (~lines 280–282, 399)
- **Issue**: Documents tab empty state uses `t('students.no_students')` → renders "No students found". Parents tab empty state has the same bug.
- **Fix**: Use `t('students.no_documents')` and `t('students.no_parents')` respectively. Add these keys to locale files.

### [MED-008] Non-Standard Badge Variants — May Silently Fall Back to Default Style
- **File**: `packages/frontend/src/pages/academic/AcademicYearListPage.tsx` (~line 109), `SubjectListPage.tsx` (lines 36–39)
- **Issue**: `<Badge variant="success">`, `<Badge variant="info">`, `<Badge variant="amber">`, `<Badge variant="purple">` — shadcn Badge ships with `default`, `secondary`, `destructive`, `outline` only. Custom variants may silently fall back to default, making status badges meaningless.
- **Fix**: Either extend `badge.tsx` `cva` with these variants, or use `className` overrides with the CLAUDE.md status badge color conventions (`bg-green-100 text-green-800`, etc.).

---

## LOW (Style, minor improvements)

### [LOW-001] Refresh Token DB Expiry Hardcoded to 7 Days — Diverges from `JWT_REFRESH_EXPIRES_IN` Env Var
- **File**: `packages/backend/src/modules/auth/auth.service.ts` (~line 179)
- **Issue**: `expiresAt.setDate(expiresAt.getDate() + 7)` hardcoded. If `JWT_REFRESH_EXPIRES_IN=14d` is set in `.env`, the JWT is valid 14 days but the DB record expires after 7 days → valid tokens rejected as "expired or revoked."
- **Fix**: Parse `env.JWT_REFRESH_EXPIRES_IN` to derive the DB expiry dynamically.

### [LOW-002] Toast Success Messages Are Poorly Constructed Concatenations
- **File**: `packages/frontend/src/pages/students/StudentFormPage.tsx` (lines 158, 178), `StudentDetailPage.tsx` (lines 81, 104)
- **Issue**: `t('students.add') + ' ' + t('common.actions.save')` renders as `"Add Student Save"` — a nonsensical concatenation rather than a proper success message.
- **Fix**: Use dedicated keys: `t('students.create_success')`, `t('students.update_success')`, etc.

### [LOW-003] `env.ts` Uses `console.error` at Startup — Inconsistent with Winston Logger
- **File**: `packages/backend/src/config/env.ts` (lines 26–28)
- **Issue**: Minor inconsistency — the logger isn't available before env validation so this is structurally acceptable. Add a comment explaining why.

### [LOW-004] BulkImportPage Instruction Text Not Internationalized
- **File**: `packages/frontend/src/pages/students/BulkImportPage.tsx` (~line 101)
- **Issue**: Long English instruction paragraph is hardcoded, not passed through `t()`.
- **Fix**: Add `students.import_instructions` to locale files.

---

## Summary

| Severity | Count | Issues |
|---|---|---|
| **CRITICAL** | 5 | CRIT-001 through CRIT-005 |
| **HIGH** | 7 | HIGH-001 through HIGH-007 |
| **MEDIUM** | 8 | MED-001 through MED-008 |
| **LOW** | 4 | LOW-001 through LOW-004 |
| **Total** | **24** | |

### Most Urgent (Fix Before Any Production Data)

1. **[CRIT-001]** No RLS policies in any migration — database-level tenant isolation is completely absent
2. **[CRIT-002]** `setRLSContext` never runs on any route — RLS would be a no-op even with policies
3. **[CRIT-003]** RFID card numbers stored as plaintext — physical tracking of children
4. **[CRIT-004]** File uploads with no type/size validation — arbitrary file upload to server disk
5. **[CRIT-005]** Hard delete on students — permanent irreversible data loss

### Quick Reference: Issues by File

| File | Issues |
|---|---|
| `prisma/migrations/*/migration.sql` | CRIT-001 |
| `src/index.ts` | CRIT-002 |
| `src/middleware/rls.ts` | CRIT-002 |
| `src/middleware/tenant.ts` | HIGH-004, MED-001 |
| `src/modules/student/student.routes.ts` | CRIT-004 |
| `src/modules/student/student.service.ts` | CRIT-003, CRIT-005, HIGH-001, HIGH-002, HIGH-003, MED-004, MED-005 |
| `src/modules/academic-year/academic-year.controller.ts` | MED-002 |
| `src/modules/auth/auth.service.ts` | LOW-001 |
| `src/config/env.ts` | LOW-003 |
| `pages/dashboard/DashboardPage.tsx` | HIGH-006 |
| `pages/students/StudentDetailPage.tsx` | HIGH-005, HIGH-006, HIGH-007, MED-007 |
| `pages/students/StudentFormPage.tsx` | HIGH-006, MED-003, MED-004, LOW-002 |
| `pages/students/BulkImportPage.tsx` | HIGH-006, LOW-004 |
| `pages/academic/AcademicYearListPage.tsx` | HIGH-006, MED-008 |
| `pages/academic/ClassListPage.tsx` | HIGH-006 |
| `pages/academic/SectionListPage.tsx` | HIGH-006 |
| `pages/academic/SubjectListPage.tsx` | HIGH-006, MED-008 |
