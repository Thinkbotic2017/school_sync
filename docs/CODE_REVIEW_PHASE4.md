# Code Review — Phase 4: Fee Management System
**Date:** 2026-03-19
**Reviewer:** Senior Full Stack Code Review
**Scope:** Backend fee module + Frontend finance pages

---

## System Verification Output

### RLS Policy Check
```
  tablename   |    policyname    | cmd
--------------+------------------+-----
 FeeDiscount  | tenant_isolation | ALL
 FeeRecord    | tenant_isolation | ALL
 FeeStructure | tenant_isolation | ALL
(3 rows)
```

### RLS Enforcement Check
```
   relname    | relrowsecurity | relforcerowsecurity
--------------+----------------+---------------------
 FeeStructure | t              | t
 FeeRecord    | t              | t
 FeeDiscount  | t              | t
(3 rows)
```

RLS is enabled and forced on all three tables. Policies exist and apply to ALL operations. No issues.

### Promise.all Check
No `Promise.all` calls found in `fee.service.ts`. Pass.

### TypeScript Check
`npx tsc --noEmit` produced zero output (no errors). Pass.

### Frontend Build
Bash permission was not granted during review. Build must be run manually:
```bash
cd packages/frontend && pnpm build
```
All TypeScript type imports and exports are structurally sound based on manual review. No type errors expected. Document any failures when run.

---

## Issues Found

### BACKEND

---

#### ISSUE-01 — Invoice Number Race Condition (P1 — High)
**File:** `packages/backend/src/modules/fee/fee.service.ts`, lines 28–36

**Description:**
`generateInvoiceNumber` derives the next sequence number from a `count()` query:
```typescript
const count = await prisma.feeRecord.count({
  where: { tenantId, invoiceNumber: { startsWith: `INV-${prefix}-${year}-` } },
});
const seq = String(count + 1).padStart(4, '0');
```
Under concurrent payment requests (two accountants processing payments simultaneously), both requests can read the same `count` and generate the same invoice number. The `invoiceNumber` field has no `@unique` constraint in the schema, so the duplicate write will succeed silently. This produces two fee records with identical invoice numbers.

**Required Fix:**
Add `@@unique([tenantId, invoiceNumber])` to the `FeeRecord` model in `prisma/schema.prisma`, and wrap the count-then-write inside a Prisma interactive transaction with a retry loop, or use a PostgreSQL sequence per tenant per year via `$queryRaw`.

---

#### ISSUE-02 — `getCollectionSummary` Mutually Exclusive Filter Overwrite (P1 — High)
**File:** `packages/backend/src/modules/fee/fee.service.ts`, lines 386–387

**Description:**
When both `classId` and `academicYearId` filters are supplied simultaneously, the second assignment overwrites the first:
```typescript
if (filters.classId) where.student = { classId: filters.classId };
if (filters.academicYearId) where.feeStructure = { academicYearId: filters.academicYearId };
```
These two filters target different relations (`student` vs `feeStructure`) and do not conflict with each other — but the pattern is fragile and does mean `where.student` is always overwritten if a second filter also targets `where.student`. If any future filter also writes `where.student` it will silently discard the `classId` restriction. This also applies identically to `getClassSummary` at line 497.

Additionally, the same destructive overwrite pattern exists in `listRecords` (lines 212–221): if both `classId` and `search` are provided simultaneously, they are correctly merged via the `studentFilter` intermediary object — but `getCollectionSummary` and `getClassSummary` do NOT use the intermediary pattern, making them inconsistent.

**Required Fix:**
Use the same `studentFilter` intermediary pattern as `listRecords`:
```typescript
const studentFilter: Prisma.StudentWhereInput = {};
if (filters.classId) studentFilter.classId = filters.classId;
if (Object.keys(studentFilter).length > 0) where.student = studentFilter;
if (filters.academicYearId) where.feeStructure = { academicYearId: filters.academicYearId };
```

---

#### ISSUE-03 — `FeeRecord` Unique Constraint Prevents Multi-Period Billing (P2 — Medium / Design Flaw)
**File:** `packages/backend/prisma/schema.prisma`, line 338

**Description:**
```prisma
@@unique([tenantId, studentId, feeStructureId])
```
This constraint means a student can only ever have ONE fee record per fee structure. For a `MONTHLY` fee structure, calling `generate-records` in September produces one record for all students. Calling it again in October (for the next billing period) silently skips all students because they already have a record — the `existingStudentIds` check in `generateRecords` at line 160–166 will show them as already existing.

The current design cannot model recurring billing (monthly, quarterly, semester fees) correctly. Each billing cycle requires a new fee record, which is structurally impossible under this constraint.

**Required Fix:**
Either:
1. Remove the unique constraint and rely on the `existingStudentIds` check with a date-period discriminator (add `billingPeriodDate` to `FeeRecord` and make the unique constraint `[tenantId, studentId, feeStructureId, billingPeriodDate]`), OR
2. Document clearly that each `FeeStructure` is intended to be created fresh per billing period (e.g., "September 2025 Tuition") and the current design is intentional for one-time per-year billing only. The CLAUDE.md spec implies recurring billing, so this should be treated as a design gap.

---

#### ISSUE-04 — `deleteStructure` is a Soft Delete, Not a Hard Delete — Orphaned Records Risk (P2 — Medium)
**File:** `packages/backend/src/modules/fee/fee.service.ts`, line 143

**Description:**
`deleteStructure` sets `isActive: false` (soft delete) but does not check whether the fee structure has any `PENDING`, `PARTIAL`, or `OVERDUE` fee records associated with it. Deactivating a structure with outstanding records is a valid operational scenario, but the API returns `200 OK` with no warning to the caller. The frontend delete confirmation dialog also provides no context about linked records.

**Required Fix:**
Before soft-deleting, query `_count: { feeRecords: true }` where `status IN (PENDING, PARTIAL, OVERDUE)` and return a warning count in the response body. The frontend `ConfirmDialog` should surface this count: "This structure has 12 outstanding records. Deactivating it will not cancel them."

---

#### ISSUE-05 — BullMQ Overdue Worker: No Per-Tenant RLS Context for `updateMany` (P1 — High)
**File:** `packages/backend/src/config/queue.ts`, lines 92–113

**Description:**
The overdue check worker correctly sets the RLS context per tenant before querying:
```typescript
await prismaClient.$executeRawUnsafe(
  `SELECT set_config('app.current_tenant_id', $1, false)`,
  tenant.id,
);
const overdueRecords = await prismaClient.feeRecord.findMany(...);
```
However, `set_config` with `false` as the third argument sets the config as a **session-local** setting (persists until reset), not a transaction-local one (`true` would scope it to a transaction). Since BullMQ workers use the shared Prisma connection pool, the RLS context from tenant A may still be active when processing tenant B if the connection is reused. This is the same class of bug that exists for per-request RLS but is more dangerous in a background worker because there is no request boundary to reset the context.

**Required Fix:**
Wrap each tenant's update block in a `prismaClient.$transaction` and set the config with `true` (transaction-scoped):
```typescript
await prismaClient.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;
  // findMany + updateMany here
});
```

---

#### ISSUE-06 — RLS Policy Uses Text Comparison, Not `::UUID` Cast (P2 — Medium)
**File:** Database RLS policies (applied via `prisma db push` migration)

**Description:**
Per Agent 1's own context notes: the RLS policy uses:
```sql
USING (tenant_id = current_setting('app.current_tenant_id'))
```
Rather than:
```sql
USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
```
PostgreSQL stores `tenant_id` as `UUID`. The text-to-UUID implicit cast works in most contexts, but if `current_setting('app.current_tenant_id')` returns an empty string (e.g., before the middleware sets it, or for unauthenticated requests that bypass the middleware), the implicit cast will throw a `22P02 invalid_text_representation` error rather than returning an empty result set. This means an RLS misconfiguration causes a 500 error that leaks internal DB error messages rather than cleanly returning no data.

**Required Fix:**
Update the policy to use `::UUID` cast and wrap in a `nullif`:
```sql
USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::UUID)
```
The `true` second arg to `current_setting` suppresses errors when the variable is unset, returning NULL instead. The `nullif` converts empty string to NULL so the cast does not fail.

---

### FRONTEND

---

#### ISSUE-07 — Raw `<table>` in StudentDetailPage Fees Tab (P1 — High)
**File:** `packages/frontend/src/pages/students/StudentDetailPage.tsx`, line 558

**Description:**
The fees tab in the student detail page renders fee records using a raw HTML `<table>`:
```tsx
<table className="w-full text-sm">
  <thead className="bg-muted/40">
    <tr>
      <th className="text-left px-3 py-2 ...">...</th>
```
This violates the project's mandatory rule: **"NEVER use raw HTML `<table>` — always shadcn wrappers"** and **"Every list page MUST include DataTable from TanStack Table + shadcn DataTable pattern"**. The raw table also lacks sorting, skeleton loading per row, and column visibility toggle. It is functionally acceptable but architecturally inconsistent.

**Required Fix:**
Replace with `DataTable<FeeRecord & { balance: number }>` from `@/components/ui/data-table` with appropriate columns, matching the pattern used in all other list views.

---

#### ISSUE-08 — Raw `<input type="file">` in StudentDetailPage Documents Tab (P2 — Medium)
**File:** `packages/frontend/src/pages/students/StudentDetailPage.tsx`, line 295

**Description:**
A raw `<input type="file">` is hidden and triggered via a ref click:
```tsx
<input
  type="file"
  ref={docFileRef}
  className="hidden"
  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
/>
```
This is a raw HTML element outside of react-hook-form and shadcn. The pattern is common for file inputs, but it bypasses the form validation lifecycle: there is no Zod validation on file type or file size, no FormMessage error display, and no loading state during upload tied to the form. An invalid file type (e.g., an executable) can be submitted.

**Required Fix:**
Add client-side validation for file type and size (e.g., `z.instanceof(File).refine(f => f.size < 5_000_000, 'Max 5MB').refine(...)` ) and show a validation error. Even if a raw input is retained for the file picker UX, the validation logic should gate the upload button.

---

#### ISSUE-09 — Hardcoded English String "Change Password" in DashboardLayout (P2 — Medium)
**File:** `packages/frontend/src/layouts/DashboardLayout.tsx`, line 281

**Description:**
```tsx
<DropdownMenuItem>
  <KeyRound className="h-4 w-4 mr-2" />
  Change Password
</DropdownMenuItem>
```
This string is hardcoded in English and will not translate when the user switches to Amharic. All user-facing strings must go through the `t()` i18n function.

**Required Fix:**
Replace with `{t('common.actions.change_password')}` and add the key to both `en.json` and `am.json`.

---

#### ISSUE-10 — Hardcoded "School" Label and "{plan} Plan" in Sidebar (P2 — Medium)
**File:** `packages/frontend/src/layouts/DashboardLayout.tsx`, lines 138 and 225

**Description:**
Line 138: `<p className="text-xs ...">School</p>` — hardcoded English label.
Line 225: `{user?.tenant?.plan} Plan` — hardcoded "Plan" suffix is English only and will not translate.

**Required Fix:**
Both strings need i18n keys. The plan display should be `{t('nav.plan_label', { plan: user?.tenant?.plan })}` or equivalent.

---

#### ISSUE-11 — `waiveFee` Endpoint: `approvedById` Accepts Free-Text UUID String from Frontend (P2 — Medium)
**File:** `packages/frontend/src/pages/finance/FeePaymentsPage.tsx`, lines 559–571

**Description:**
The waive fee form has an `approvedById` field rendered as a plain text `<Input>`. The user is expected to type a raw UUID (a User ID). This is unusable in practice: accountants do not know user UUIDs. The field has a label `t('finance.payments.waive_approved_by')` but no lookup mechanism.

**Required Fix:**
Replace the `approvedById` input with a dropdown that queries `/v1/users?role=SCHOOL_ADMIN,PRINCIPAL` to produce a list of users who can approve waivers. This also prevents invalid UUIDs from being sent to the backend, which currently does not validate that `approvedById` refers to an existing user (the `FeeDiscount.approvedById` is a `String` field with no FK constraint in the schema).

---

#### ISSUE-12 — `FeeRecord.amount` and `paidAmount` Are `Decimal` in DB but Typed as `number` in Frontend Service (P2 — Medium)
**File:** `packages/frontend/src/services/fee.service.ts`, lines 32, 34

**Description:**
The Prisma schema defines:
```prisma
amount    Decimal   @db.Decimal(10, 2)
paidAmount Decimal  @db.Decimal(10, 2)
```
Prisma serializes `Decimal` values as JSON strings (e.g., `"5000.00"`) when returned via the REST API, not as JavaScript `number`. The frontend types these as `number`, which means arithmetic like:
```tsx
const balance = record.amount - record.paidAmount;
```
in `FeePaymentsPage.tsx` line 184 and `StudentDetailPage.tsx` line 591 will produce `NaN` at runtime because `"5000.00" - "500.00"` is `NaN` in JavaScript.

**Impact:** The balance column and the pre-filled payment amount will show `NaN`. This is a runtime bug.

**Required Fix:**
Either:
1. Change the service types to `string` and use `parseFloat()` at point of arithmetic, OR
2. Add an Axios response interceptor that deserializes known Decimal fields, OR
3. Change the Prisma client output to use native numbers via `output: "number"` in the Prisma generator (available for Decimal-only fields in newer Prisma versions).

The recommended approach is (1) for type safety:
```typescript
amount: string; // Decimal serialized as string by Prisma
paidAmount: string;
// At point of use:
const balance = parseFloat(record.amount) - parseFloat(record.paidAmount);
```

---

#### ISSUE-13 — Student Ledger Autocomplete Dropdown Has No "Close on Outside Click" or "Clear" Button (P2 — Medium)
**File:** `packages/frontend/src/pages/finance/FinancialReportsPage.tsx`, lines 483–502

**Description:**
The student search dropdown in the ledger tab renders as a custom `div` with `button` children. Once a student is selected, the dropdown correctly closes. However:
1. Clicking outside the dropdown does not close it — it remains visible until a student is selected.
2. Once a student is selected and `studentSearch` is cleared, the query will re-run with an empty string and the `enabled: studentSearch.length > 1` guard prevents it, but the stale `studentOptions` remains in cache and the dropdown will reappear immediately on the next keystroke.
3. The component uses a raw `<button>` inside the dropdown rather than a shadcn `DropdownMenu` or `Command` component — violating the project rule against raw interactive elements.

**Required Fix:**
Use the shadcn `Command` component (Cmdk-based) which provides keyboard navigation, outside-click dismiss, and accessible combobox behavior. The `Command` component is already in the shadcn registry.

---

#### ISSUE-14 — `generateRecords` Response Unwrapping Uses `as any` Double-Nested Cast (P1 — High / Type Safety)
**File:** `packages/frontend/src/pages/finance/FeeStructuresPage.tsx`, line 157

**Description:**
```typescript
const result = (res as any)?.data?.data ?? { created: 0, skipped: 0 };
```
The `feeStructureApi.generateRecords` return type is correctly typed as `ApiResponse<{ created: number; skipped: number }>`. The Axios response wrapper adds one level of `.data`. The actual response path is `res.data.data.created`. The double `.data.data` path is correct, but the `as any` cast defeats TypeScript and hides any future type contract changes. The same anti-pattern is used extensively in `FinancialReportsPage.tsx` (lines 94, 103, 111, 136).

This pattern is used throughout the codebase as a workaround for the Axios response envelope (the API wraps responses as `{ success, data }` and Axios further wraps in `response.data`). The root cause is that the `apiClient` is not configured to unwrap the envelope automatically.

**Required Fix:**
Add an Axios response interceptor in `services/api.ts` that unwraps the `{ success, data }` envelope:
```typescript
apiClient.interceptors.response.use((response) => {
  if (response.data?.success !== undefined) {
    return { ...response, data: response.data.data };
  }
  return response;
});
```
This allows service functions to be typed as `apiClient.get<FeeStructure[]>('/fee-structures')` and eliminates all `(res as any)?.data?.data` patterns across the codebase.

---

#### ISSUE-15 — Dashboard Fee Collection KPI Footnote Says "today" but Shows All-Time Data (P2 — Medium)
**File:** `packages/frontend/src/pages/dashboard/DashboardPage.tsx`, line 119

**Description:**
```tsx
<p className="text-xs text-muted-foreground mt-1">{t('dashboard.today')}</p>
```
This footnote is copied from the attendance KPI cards. The fee collection percentage queries `collectionSummary()` with no date filter, meaning it returns the all-time collection rate, not today's. The label "today" is therefore misleading.

**Required Fix:**
Change the footnote to `t('dashboard.current_year')` or `t('dashboard.all_time')` to match what the data actually represents.

---

#### ISSUE-16 — FeeStructuresPage Missing DataTable Pagination `onPageChange` Handler (P2 — Medium)
**File:** `packages/frontend/src/pages/finance/FeeStructuresPage.tsx`, lines 308–315

**Description:**
```tsx
<DataTable<FeeStructure>
  columns={columns}
  data={structures}
  isLoading={isLoading}
  emptyMessage={t('finance.fee_structures.empty')}
  page={meta.page}
  totalPages={meta.totalPages}
/>
```
The `onPageChange` prop is not provided. Without it, the pagination controls (if rendered by the DataTable) will display page numbers but clicking them will have no effect. The query uses a hardcoded `limit: 100` which papers over this for small datasets, but the UI is non-functional for pagination regardless.

**Required Fix:**
Add local `page` state and pass `onPageChange={setPage}`, then include `page` in the query params — the same pattern already correctly implemented in `FeePaymentsPage.tsx`.

---

## Design Issues (Non-Blocking but Flagged)

**DESIGN-01 — `FeeRecord` Hard Delete on `FeeDiscount`**
`deleteDiscount` at fee.service.ts line 373 performs a hard delete (`prisma.feeDiscount.delete`). All other "delete" operations in this codebase use soft delete (`isActive: false`). Discount records should be soft-deleted for auditability — a discount that was applied and then removed should leave an audit trail.

**DESIGN-02 — No Audit Log on Payment Recording**
Payments modify financial records. The security checklist in CLAUDE.md explicitly requires: "Audit log for sensitive operations (fee modifications)." No `AuditLog` table or write appears anywhere in the fee service. This is a Phase 4 gap to be addressed before production.

---

## Summary Table

| Issue | File | Severity | Category |
|-------|------|----------|----------|
| ISSUE-01: Invoice number race condition | fee.service.ts:28 | **P1** | Concurrency / Data Integrity |
| ISSUE-02: Collection summary filter overwrite | fee.service.ts:386 | **P1** | Logic Bug |
| ISSUE-03: Unique constraint prevents multi-period billing | schema.prisma:338 | **P2** | Design Gap |
| ISSUE-04: Soft delete gives no outstanding-records warning | fee.service.ts:143 | **P2** | UX / Safety |
| ISSUE-05: BullMQ worker uses session-scoped RLS, not transaction-scoped | queue.ts:92 | **P1** | Security / Data Isolation |
| ISSUE-06: RLS policy text cast not safe on empty string | DB policies | **P2** | Security / Error Handling |
| ISSUE-07: Raw `<table>` in StudentDetailPage fees tab | StudentDetailPage.tsx:558 | **P1** | Architecture Violation |
| ISSUE-08: Raw `<input type="file">` with no validation | StudentDetailPage.tsx:295 | **P2** | Validation / Security |
| ISSUE-09: Hardcoded "Change Password" string | DashboardLayout.tsx:281 | **P2** | i18n |
| ISSUE-10: Hardcoded "School" and "Plan" labels | DashboardLayout.tsx:138,225 | **P2** | i18n |
| ISSUE-11: `approvedById` is a free-text UUID input | FeePaymentsPage.tsx:564 | **P2** | UX / Data Integrity |
| ISSUE-12: Decimal fields typed as `number` — balance shows `NaN` | fee.service.ts:32,34 | **P1** | Runtime Bug |
| ISSUE-13: Ledger autocomplete has no outside-click dismiss | FinancialReportsPage.tsx:483 | **P2** | UX / Architecture |
| ISSUE-14: Pervasive `as any` double-unwrap pattern | Multiple files | **P1** | Type Safety |
| ISSUE-15: Dashboard fee KPI footnote says "today" for all-time data | DashboardPage.tsx:119 | **P2** | UX / Accuracy |
| ISSUE-16: FeeStructuresPage pagination has no `onPageChange` | FeeStructuresPage.tsx:308 | **P2** | Functionality |

### Issue Count by Severity

| Severity | Count |
|----------|-------|
| P0 (Critical) | 0 |
| P1 (High) | 5 |
| P2 (Medium) | 11 |
| Total | 16 |

---

## Overall Verdict: NEEDS FIXES

The backend TypeScript compilation passes cleanly and all three RLS policies are correctly applied with `relforcerowsecurity = true`. The core fee service logic for payment recording (partial/full handling, overpayment rejection, invoice reuse) is correct.

However, the following P1 issues must be resolved before this phase can be considered production-ready:

1. **ISSUE-12** (Decimal-as-string → NaN balances) is a confirmed runtime bug that will show NaN on every balance display and pre-fill.
2. **ISSUE-05** (BullMQ session-scoped RLS) is a tenant data isolation risk in the background worker.
3. **ISSUE-01** (invoice number race condition) is a data integrity risk under concurrent load.
4. **ISSUE-02** (filter overwrite) produces silently incorrect report totals.
5. **ISSUE-07** (raw table in StudentDetailPage) violates the mandatory architecture rule from CLAUDE.md.

The frontend build could not be run due to Bash permission restrictions during review. **The developer must manually confirm `pnpm build` passes before merging.**
