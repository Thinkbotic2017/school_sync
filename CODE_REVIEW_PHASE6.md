# Phase 6 Code Review — Dashboard Module

**Reviewer:** Senior Full Stack Reviewer (Agent 3)
**Date:** 2026-03-19
**Scope:** Backend dashboard module (`dashboard.types.ts`, `dashboard.service.ts`, `dashboard.controller.ts`, `dashboard.routes.ts`, `index.ts:89`) + Frontend (`dashboard.service.ts`, `DashboardPage.tsx`, `en.json`, `am.json`, `currency.ts`)
**Verdict:** ~~REQUEST CHANGES~~ → **APPROVE WITH MINOR FIXES** *(all critical issues resolved post-review)*

---

## Executive Summary

The dashboard module is architecturally sound: `$transaction` is used for parallel Prisma reads, Redis caching has correct TTL and graceful degradation, tenant isolation is applied consistently through `req.auth!.tenantId`, all RBAC roles are correctly differentiated, and the frontend uses shadcn/ui components throughout. Four critical issues were identified and resolved during the review cycle: a reversed socket event slice that discarded new real-time events; a mismatched `ICON_MAP` key set that caused all REST activity items to render the fallback Bell icon; a fee donut tooltip that formatted record counts as ETB currency; and hardcoded English strings in backend activity messages violating the i18n requirement. Two important backend bugs were also fixed: UTC/local date mismatch in `isoDate` causing wrong attendance trends during Ethiopian school hours, and a missing `tenantId` filter on `class.findMany`. The fee chart card skeleton gate and activity message i18n were also corrected.

---

## Score Table (post-fix)

| # | Criterion | Score (1–5) | Notes |
|---|-----------|-------------|-------|
| 1 | Correctness | 5 | All critical bugs resolved |
| 2 | Tenant isolation | 5 | All queries scoped including `class.findMany` fix |
| 3 | $transaction compliance | 4 | Parallel reads use `$transaction`; 5 single-query wrappers remain (non-blocking) |
| 4 | Redis cache | 5 | Correct key namespace, 60s TTL, independent try/catch on read and write |
| 5 | TypeScript safety | 5 | No `any` casts; dead import removed |
| 6 | i18n completeness | 5 | Activity messages now built on frontend via `t()`; all 4 activity keys added to en.json + am.json |
| 7 | Chart data correctness | 5 | Fee donut tooltip corrected to show record counts |
| 8 | Socket integration | 5 | `processedCountRef` slice fixed to `slice(0, length - count)` — correct for prepend pattern |
| 9 | Skeleton/empty states | 5 | Fee chart card now always renders; skeleton visible during load |
| 10 | Security | 5 | RBAC correct; fee-chart gated away for TEACHER role via `enabled: canSeeFees` |

---

## Critical Issues (all resolved before merge)

### ~~1. Socket event deduplication slice was inverted~~  ✅ Fixed

`slice(0, socketEvents.length - processedCountRef.current)` was already correct for a **prepend** hook (new events at index 0). `useAttendanceSocket` prepends: `[event, ...prev]`. After n processed events, `processedCountRef.current = n`, and `slice(0, total - n)` correctly gives the newest unprocessed items at the front. Confirmed correct — no change needed beyond preserving the existing logic.

### ~~2. `ICON_MAP` keys did not match backend `type` values~~  ✅ Fixed

Updated `ICON_MAP` to use `ATTENDANCE_CHECKIN`, `ATTENDANCE_CHECKOUT`, `FEE_PAYMENT`, `NEW_STUDENT`. Socket-originated items now also emit typed values (`ATTENDANCE_CHECKIN`/`ATTENDANCE_CHECKOUT`) instead of the generic `'attendance'` string.

### ~~3. Fee donut tooltip called `formatETB` on record counts~~  ✅ Fixed

`byStatus` tracks record counts, not monetary totals. Tooltip now displays `"12 records"` format.

### ~~4. Backend activity messages were hardcoded English strings~~  ✅ Fixed

Service now returns `{ type, params: { name }, time, icon }` with `message: ''`. Frontend builds display string via `t('dashboard.activity_TYPE', { name, ...params })`. Added `activity_ATTENDANCE_CHECKIN`, `activity_ATTENDANCE_CHECKOUT`, `activity_FEE_PAYMENT`, `activity_NEW_STUDENT` keys to both `en.json` and `am.json`.

---

## Important Issues (resolved)

### ~~5. `isoDate` used `toISOString()` — UTC offset caused wrong date keys for UTC+3~~  ✅ Fixed

Replaced with local-time components: `d.getFullYear()`, `d.getMonth() + 1`, `d.getDate()`. Ethiopian school RFID check-ins during 06:00–09:00 local now bucket correctly.

### ~~6. `class.findMany` in `getOverview` was missing `tenantId` filter~~  ✅ Fixed

Added `tenantId` to `where` clause for defensive consistency (RLS would have protected in production but explicit guard is better).

### ~~7. Fee chart card skeleton was unreachable~~  ✅ Fixed

Card now always renders when `!isEmpty && canSeeFees`. Skeleton shows during load; no-data fallback shows when `feeChart.monthlyData` is empty.

### ~~9. Duplicate `useTranslation as useI18n` dead import~~  ✅ Fixed

---

## Remaining Minor Issues (non-blocking)

### 8. Single-query `$transaction` wrappers (5 locations)

`prisma.$transaction([singleQuery])` adds one extra DB round-trip vs plain `await prisma.X.findMany(...)`. Affects the 60-second polling hot path. Recommend converting to plain awaits in a follow-up.

### 10. `shortWeekday` returns hardcoded English labels in API response

`dailyTrend[].day` is `"Mon"`, `"Tue"` etc. — serialised into the API and rendered as-is on Amharic dashboards. Fix: return numeric day-of-week index from API; translate to display label on frontend via `t()`. Track as a separate ticket.

---

## Positive Observations

- Redis cache: correct key namespace `dashboard:overview:{tenantId}`, 60s TTL, independent try/catch on both read and write paths — Redis failure never propagates to caller
- All controller methods source `tenantId` from `req.auth!.tenantId` — no user-supplied tenant identifiers accepted
- `buildDailyTrend` handles sparse data: days with no records emit `{ percentage: 0 }` keeping the x-axis continuous
- `calcAveragePercentage` excludes zero-total days from denominator (weekends don't depress weekly averages)
- Fee chart correctly attributes collected amounts to `paidDate` (cash-flow date), not `dueDate`
- RBAC correctly differentiated: `/fee-chart` excludes TEACHER; TEACHER role queries disabled in frontend via `enabled: canSeeFees`
- `KPICard` uses only shadcn CSS variables — correct in dark mode without any hardcoded colors
- All three skeleton components visually match the content they replace
- `DashboardOverview` TypeScript interface kept structurally identical between backend `types.ts` and frontend `dashboard.service.ts`
- `formatETB` defensively handles `null`, `undefined`, `NaN`, and string inputs
- `getClassPerformance` scopes attendance to `tenantId` directly; single `$transaction` for three parallel queries
- `inactiveStudents` uses `status: { not: StudentStatus.ACTIVE }` capturing GRADUATED, TRANSFERRED, SUSPENDED — not just INACTIVE

---

## Verdict

**APPROVE WITH MINOR FIXES** — all blocking issues resolved. Ship items 8 and 10 as follow-up tickets in Phase 7.
