# Code Review — Phase 5A: Fix All Broken Pages & APIs

**Reviewer:** Senior Full Stack Reviewer
**Date:** 2026-03-20
**Scope:** Academic year, class, section, subject backend modules + student form, finance pages, dashboard layout, routes, and i18n files.

---

## Summary

Phase 5A focused on stabilising previously broken pages and APIs. The overall quality is high. The critical `Promise.all` / RLS pattern violations that plagued earlier phases have been fully eradicated from every service reviewed. The `setRLSContext` middleware is applied correctly at the global router level. Cascading dropdowns are correctly guarded with `enabled` and reset dependent state on change. All user-visible strings pass through `t()` with matching en.json and am.json entries — with one notable exception in the layout. No raw HTML form controls appear anywhere; every form uses react-hook-form + Zod + shadcn Form. However, there are several medium-severity issues that must be addressed before going to production, and a handful of lower-priority warnings.

---

## Backend Review

### Critical Issues (must fix before going live)

**1. `create` and `update` / `setCurrent` in `AcademicYearService` open a second Prisma transaction that bypasses the RLS-scoped `req.db` client.**

Location: `/packages/backend/src/modules/academic-year/academic-year.service.ts`, lines 70, 97, 132.

All three methods call `prisma.$transaction(async (tx) => { ... })` using the **global** `prisma` singleton, not the `db` parameter that carries the RLS-scoped interactive transaction client. This creates a brand-new database connection with no `set_config('app.current_tenant_id', ...)` applied. Any `updateMany` or `create` inside those inner transactions operates **without tenant isolation** and could, in theory, touch another school's rows.

The outer `isCurrent` flag enforcement logic must be performed inside the already-open interactive transaction received via `db`, not via a new `prisma.$transaction(...)`. Because `db` is a transaction client, all operations already share one connection where the RLS context was set.

**2. Hard delete on `AcademicYear`, `Class`, `Section`, and `Subject` violates the project's soft-delete convention.**

Location: all four `.service.ts` files, `delete()` methods.

CLAUDE.md rule: "Soft delete: set status/isActive, never hard delete." All four services call `db.*.delete({ where: { id } })` — a destructive hard delete. This is a data integrity regression. If these records are referenced by historical attendance, fee records, or grade data the foreign-key cascade or orphan records problem will manifest in production.

Fix: add an `isActive` / `deletedAt` column to each table and set that flag instead of issuing a physical delete. The frontend list queries should already filter by `isActive: true`.

---

### Warnings (should fix)

**3. Input validation is not enforced in the `SubjectController.list` handler for the `type` query parameter.**

Location: `subject.controller.ts`, line 18.

```typescript
type: type as 'CORE' | 'ELECTIVE' | 'EXTRACURRICULAR' | undefined,
```

The cast bypasses Zod validation — an attacker can pass any arbitrary string and it propagates to the Prisma `where` clause. The `subjectFiltersSchema` in the validator should enforce `z.enum([...]).optional()` for `type`, and the controller should trust the validated value rather than casting from raw query string.

**4. No input validation for `page` and `limit` query parameters before `Number()` coercion.**

Location: `academic-year.controller.ts` line 12, `class.controller.ts` lines 9-11, `section.controller.ts` lines 9-11, `subject.controller.ts` lines 9-11.

`Number(page)` returns `NaN` if the caller passes `?page=abc`. Although the service guards with `?? PAGINATION.DEFAULT_PAGE`, passing `NaN` to `(NaN - 1) * limit` evaluates to `NaN`, which Prisma passes to PostgreSQL as `NULL` for `OFFSET`, silently returning the full result set. The pagination Zod schemas (`paginationSchema`, `classFiltersSchema`, etc.) must coerce and validate these parameters before they reach the controller.

**5. `classService.delete` only checks `student.classId`; students assigned to sections inside this class via `sectionId` alone could become orphaned.**

Location: `class.service.ts`, line 154.

```typescript
const studentCount = await db.student.count({ where: { classId: id, tenantId } });
```

If a school moves students to sections but clears the direct `classId` link, this guard under-counts. Consider also counting students whose `section.classId === id`.

**6. `AcademicYearService.delete` checks `class.count` but not `subject.count`.**

Location: `academic-year.service.ts`, line 115.

Subjects also carry an `academicYearId`. Deleting an academic year while subjects still reference it will either cascade-delete subjects (if a FK cascade is configured) or cause a FK constraint error. Add a `subjectCount` guard alongside the `classCount` guard.

---

### Good Patterns Found

- Every service method signature accepts a `db: DbClient = prisma` parameter and all controllers pass `req.db`. The interactive-transaction / RLS architecture is understood and consistently applied for all **read** operations and simple writes.
- Sequential `await` pattern for `count` followed by `findMany` is correctly used throughout — no `Promise.all` found in any of the four new services.
- Tenant ownership verification before FK references is performed correctly in every create/update path (e.g. verifying `academicYear.tenantId` before creating a class, verifying `class.tenantId` before creating a section).
- Conflict detection (duplicate name within same academic year / class) is thorough and returns typed `ConflictError` rather than leaking database constraint errors to clients.
- The global middleware chain (`authenticate → resolveTenant → setRLSContext`) is correctly wired in `index.ts` for every protected route group. Route files are clean and do not re-apply auth individually.
- `setRLSContext` correctly uses `set_config(..., true)` (transaction-local) and holds the transaction open via a `Promise` listening to the `res.finish`/`close`/`error` events. This is the right pattern.

---

## Frontend Review

### Critical Issues

**7. Hardcoded English string "Change Password" in `DashboardLayout.tsx`.**

Location: `DashboardLayout.tsx`, line 308.

```tsx
<DropdownMenuItem>
  <KeyRound className="h-4 w-4 mr-2" />
  Change Password
</DropdownMenuItem>
```

This is a raw English string in UI code — it must go through `t('auth.change_password.title')`. The translation key already exists in both `en.json` (line 45) and `am.json` (line 44).

**8. Hardcoded English string "School" label in `DashboardLayout.tsx`.**

Location: `DashboardLayout.tsx`, line 151.

```tsx
<p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider font-medium">School</p>
```

This string is not in either locale file and is not passed through `t()`. A nav i18n key such as `nav.school_label` must be added to both locale files.

**9. Hardcoded English string "{plan} Plan" in `DashboardLayout.tsx`.**

Location: `DashboardLayout.tsx`, line 252.

```tsx
<p className="text-xs text-sidebar-foreground/40 text-center">
  {user?.tenant?.plan} Plan
</p>
```

The word "Plan" is hardcoded. It must be wrapped in a `t()` call or a composite i18n key.

**10. Amharic locale file contains dozens of untranslated strings (marked with the flag placeholder).**

Location: `am.json`, throughout.

Multiple keys across `academic.year`, `academic.class`, `academic.section`, `academic.subject`, `students` sections still carry the `🇪🇹` flag as a stand-in for real Amharic translation (e.g. lines 129-135, 145-152, 161-166, 179-188, 238-254). These will render as emoji + English text in production for Amharic-language users. All pending flag-prefixed strings need proper Amharic translations before the Ethiopian market launch.

**11. `StudentFormPage.tsx` uses a raw `(s as any)` cast to access `class.academicYearId`.**

Location: `StudentFormPage.tsx`, line 98.

```typescript
const yearId: string = (s as any).class?.academicYearId ?? (s as any).academicYearId ?? '';
```

The student API response type does not expose `class.academicYearId`. Rather than casting to `any`, the backend `student.getById` response should include that field explicitly, and the frontend Student type should be updated to reflect it. Using `any` disables TypeScript's safety guarantees at this exact touchpoint where a type mismatch would silently produce an empty string and break the cascade pre-population on the edit form.

**12. `FeePaymentsPage.tsx` — the `approvedById` waive field is a raw text input for a User ID.**

Location: `FeePaymentsPage.tsx`, lines 591-604.

The waive form accepts a free-text user ID rather than a searchable user select. A malicious or careless user could supply any string. This is a UX and data integrity issue: the field should either be a staff user picker or be auto-populated from `req.auth.userId` on the backend, removing it from the client form entirely.

---

### Warnings (should fix)

**13. `FinancialReportsPage.tsx` — the `classes` dropdown query is not gated with `enabled`.**

Location: `FinancialReportsPage.tsx`, lines 108-116.

```typescript
const { data: classesRes } = useQuery({
  queryKey: ['classes-reports', academicYearFilter],
  queryFn: () =>
    classApi.list({
      academicYearId: academicYearFilter !== 'all' ? academicYearFilter : undefined,
      limit: 200,
    }),
});
```

When `academicYearFilter === 'all'`, the query fires with no `academicYearId` filter and fetches all classes from all years. This is a large unfiltered payload and will slow page initial load. Adding `enabled: academicYearFilter !== 'all'` (or fetching eagerly with a small limit for the "all" case) would be more appropriate. Compare with the correct pattern in `FeeStructuresPage.tsx` line 99 which properly guards with `enabled: !!dialogAcademicYearId`.

**14. `StudentFormPage.tsx` — success toast message is concatenating two translation strings instead of using a single dedicated key.**

Location: `StudentFormPage.tsx`, lines 164, 183.

```typescript
toast.success(t('students.add') + ' ' + t('common.actions.save'));
```

This produces "Add Student Save" in English and whatever concatenation emerges in Amharic, which will not be grammatically correct in most languages. A dedicated `students.saved` and `students.updated` key should be used.

**15. `FeePaymentsPage.tsx` — balance calculation uses `parseFloat` on Prisma Decimal strings without guard.**

Location: `FeePaymentsPage.tsx`, lines 194, 249.

```typescript
const balance = parseFloat(record.amount) - parseFloat(record.paidAmount);
```

`parseFloat` returns `NaN` if the string is malformed. The balance column, the pre-fill logic in `openPaymentDialog`, and the dialogs all depend on this. A utility function (similar to `formatETB`) that returns `0` on bad input would be safer.

**16. `FinancialReportsPage.tsx` — student autocomplete uses a raw `<button>` inside a `<div>` dropdown instead of a shadcn `Command` / `Combobox`.**

Location: `FinancialReportsPage.tsx`, lines 576-594.

The student search for the ledger tab renders a hand-rolled dropdown using raw `<button>` elements. CLAUDE.md mandates shadcn/ui components only — `Command` + `Popover` (the shadcn Combobox pattern) should be used here for keyboard accessibility, proper focus management, and visual consistency.

**17. Routes file does not define a `404` redirect for unknown protected paths — only a catch-all to `/dashboard`.**

Location: `routes/index.tsx`, line 74.

```typescript
{ path: '*', element: <Navigate to="/dashboard" replace /> },
```

Silently redirecting unknown URLs to the dashboard gives users no feedback that the page they were trying to reach does not exist. A dedicated `NotFoundPage` component with a message and navigation link would be more appropriate.

---

### Good Patterns Found

- All forms use react-hook-form + Zod + shadcn `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` without exception. No raw `<input>`, `<select>`, or `<button>` for form controls.
- Every data table uses `DataTable` + `ColumnDef` from the TanStack-backed `@/components/ui/data-table` abstraction.
- The three-level cascading dropdown in `StudentFormPage` (Academic Year → Class → Section) is well-implemented: each level gates its `useQuery` with `enabled: !!parentId`, resets the child form value when the parent changes, and separately tracks selected IDs in local state so the academic year state does not get serialised into the DTO sent to the API.
- `FeeStructuresPage` correctly resets the class field to `'all'` when the academic year selection changes inside the dialog (line 420).
- `FeePaymentsPage` correctly resets `sectionFilter` to `'all'` and disables the section dropdown when class changes back to "all" (lines 357-360, 382-383).
- `FinancialReportsPage` correctly resets `classFilter` to `'all'` when the academic year filter changes (line 393).
- Loading states use `<Skeleton>` components that match the layout shape — no spinners anywhere.
- Dark mode support is consistent throughout via shadcn CSS variables. No hardcoded colour values in component logic (badge/status colour classes correctly include `dark:` variants).
- `ProtectedRoute` and `GuestRoute` guards in `routes/index.tsx` are clean and cover every route correctly.
- The `DashboardLayout` correctly auto-expands nav groups based on the current `location.pathname`, so refreshing on a sub-route keeps the relevant group open.
- All currency values pass through `formatETB` — no raw number formatting or hardcoded "ETB" anywhere in the reviewed files.

---

## Sign-off: FAIL

**Blocking issues before production deployment:**

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | CRITICAL | `academic-year.service.ts` L70, L97, L132 | Inner `prisma.$transaction` bypasses RLS context |
| 2 | CRITICAL | All four services, `delete()` | Hard delete violates soft-delete convention |
| 7 | CRITICAL | `DashboardLayout.tsx` L308 | Hardcoded English "Change Password" |
| 8 | CRITICAL | `DashboardLayout.tsx` L151 | Hardcoded English "School" |
| 9 | CRITICAL | `DashboardLayout.tsx` L252 | Hardcoded "Plan" suffix |
| 10 | CRITICAL | `am.json` throughout | ~30 keys still contain flag-placeholder English text |
| 11 | HIGH | `StudentFormPage.tsx` L98 | `as any` cast breaks type safety on edit pre-population |
| 12 | HIGH | `FeePaymentsPage.tsx` L591-604 | Raw user ID text input for `approvedById` — security/UX risk |

Items 1 and 2 are backend correctness issues that affect data integrity and multi-tenant security. Items 7-10 are i18n violations. All eight must be resolved before the next QA cycle.

Warnings 3–6 (backend) and 13–17 (frontend) should be addressed in the same phase to avoid accumulating technical debt before Phase 5B.
