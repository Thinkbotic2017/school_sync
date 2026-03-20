# QA Report — Phase 4: Fee Management System
**Date:** 2026-03-19
**QA Engineer:** QA Agent

## Test Results

| Test | Description | Result | Notes |
|------|-------------|--------|-------|
| TEST-1a | Backend tsc --noEmit | PASS | Zero TypeScript errors |
| TEST-1b | Frontend tsc --noEmit | PASS | Zero TypeScript errors |
| TEST-2 | Backend file completeness | PASS | All 8 required files present: fee.service.ts, fee.controller.ts, fee.routes.ts, fee.validator.ts, fee.types.ts, config/queue.ts, schema.prisma, seed.ts |
| TEST-3a | generateInvoiceNumber uses tx | PASS | Signature is `generateInvoiceNumber(tx: Prisma.TransactionClient, tenantId: string)` — uses tx throughout, not prisma directly |
| TEST-3b | BullMQ uses transaction-scoped RLS | PASS | `set_config` 3rd arg is `true` (transaction-scoped); loop uses `prismaClient.$transaction(async (tx) => {...})`; `tx.$executeRaw` tagged template literal used |
| TEST-3c | FeeRecord has both @@unique constraints | PASS | Schema has `@@unique([tenantId, studentId, feeStructureId])` and `@@unique([tenantId, invoiceNumber])` on FeeRecord model |
| TEST-3d | RBAC on all fee routes | PASS | Every route has `requireRoles(...)`. `generate-records` requires SCHOOL_ADMIN, ACCOUNTANT. `pay` and `waive` routes both allow ACCOUNTANT |
| TEST-3e | No Promise.all in fee.service | PASS | Zero matches for `Promise.all` in fee.service.ts |
| TEST-4 | Frontend file completeness | PASS | All 8 required files present: fee.service.ts, currency.ts, FeeStructuresPage.tsx, FeePaymentsPage.tsx, FinancialReportsPage.tsx, routes/index.tsx, en.json, am.json |
| TEST-5a | Decimal typed as string, parseFloat used | FAIL | `FeeRecord.amount` and `FeeRecord.paidAmount` are typed as `string` ✓. `openPaymentDialog` at line 184 correctly uses `parseFloat`. Balance column at line 239 correctly uses `parseFloat`. **However**, the dialog info summary box at line 432 computes `paymentRecord.amount - paymentRecord.paidAmount` without `parseFloat`, relying on implicit JS coercion (string arithmetic) which produces NaN in TypeScript strict mode. |
| TEST-5b | No raw `<table>` in StudentDetailPage | PASS | Zero matches for `<table` in StudentDetailPage.tsx. `DataTable` is imported and used at line 628 for the fees tab |
| TEST-5c | formatETB used in all finance pages | PASS | `formatETB` is imported and used in: FeeStructuresPage.tsx (line 209), FeePaymentsPage.tsx (lines 225, 233, 241, 425), FinancialReportsPage.tsx (lines 195, 239, 245, 284, 291, 298, 515, 519, 523), StudentDetailPage.tsx (multiple uses) |
| TEST-5d | i18n keys complete (en + am) | PASS | en.json has `finance.fee_structures`, `finance.payments`, `finance.status`, `finance.reports`, `dashboard.all_time`. am.json has all the same top-level keys with Amharic translations |
| TEST-5e | No raw `<input>` in finance pages | PASS | Zero matches for `<input` in FeeStructuresPage.tsx, FeePaymentsPage.tsx, FinancialReportsPage.tsx (all inputs use shadcn `Input` component) |
| TEST-5f | RHF + Zod in fee forms | PASS | FeeStructuresPage.tsx imports `useForm`, `zodResolver`, `z`. FeePaymentsPage.tsx imports `useForm`, `zodResolver`, `z` |
| TEST-5g | Dashboard fee KPI uses all_time | PASS | DashboardPage.tsx line 119: `t('dashboard.all_time')` is used as the sub-label for the fee collection KPI card (not `t('dashboard.today')`) |
| TEST-6a | Finance nav has 3 children | PASS | DashboardLayout.tsx lines 73-77: Finance group has exactly 3 children — Fee Structures, Payments, Financial Reports using `nav.finance_structures`, `nav.finance_payments`, `nav.finance_reports` |
| TEST-6b | All 3 finance routes defined | PASS | routes/index.tsx lines 66-68: `/finance/fee-structures`, `/finance/payments`, `/finance/reports` all defined |
| TEST-7 | Frontend build (tsc --noEmit) | PASS | Zero TypeScript errors (same as TEST-1b) |

## Summary

- **Total Tests:** 19
- **Passed:** 18
- **Failed:** 1

## Failures

### TEST-5a — Partial Failure: Raw arithmetic on Decimal string in dialog summary

**File:** `D:\Software\schoolsync\packages\frontend\src\pages\finance\FeePaymentsPage.tsx`
**Line:** 432

**Code with bug:**
```tsx
<span>
  {formatETB(paymentRecord.amount - paymentRecord.paidAmount)}
</span>
```

**Problem:** `FeeRecord.amount` and `FeeRecord.paidAmount` are typed as `string` (correct, because Prisma serializes Decimal as string). The expression `paymentRecord.amount - paymentRecord.paidAmount` performs JavaScript string subtraction, which yields `NaN` at runtime for any real Decimal string value (e.g., `"2500.00" - "0.00"` → `NaN`).

**Expected fix:**
```tsx
<span>
  {formatETB(parseFloat(paymentRecord.amount) - parseFloat(paymentRecord.paidAmount))}
</span>
```

**Note:** This bug is in the dialog info summary display only. The `openPaymentDialog` handler (line 184) and the balance column cell (line 239) both correctly use `parseFloat()`. The TypeScript compiler did not catch this because JavaScript allows implicit string subtraction.

## Overall Verdict: FAIL

One failure (TEST-5a): Raw arithmetic on Prisma Decimal string in the payment dialog summary box (`FeePaymentsPage.tsx` line 432) will produce `NaN` at runtime. All other 18 tests pass.
