# QA Report — Phase 6: Dashboard Module

**Project:** SchoolSync — White-Label School Management Platform
**Module:** Dashboard (Backend + Frontend)
**Report Date:** 2026-03-19
**QA Engineer:** Static Analysis (Claude)
**Risk Rating:** HIGH

---

## 1. Test Coverage Analysis

### Backend — `packages/backend/src/modules/dashboard/`

No `__tests__` directory exists anywhere under `packages/backend/src/modules/dashboard/`. Zero tests have been written for this module. The project has no test infrastructure in place for any backend module (only third-party library test stubs are present in `node_modules`).

| Function / Endpoint | Test File Exists | Coverage |
|---|---|---|
| `dashboardService.getOverview(tenantId)` | No | 0% |
| `dashboardService.getAttendanceChart(tenantId, period)` | No | 0% |
| `dashboardService.getFeeChart(tenantId, period)` | No | 0% |
| `dashboardService.getClassPerformance(tenantId)` | No | 0% |
| `dashboardController.getOverview` | No | 0% |
| `dashboardController.getAttendanceChart` | No | 0% |
| `dashboardController.getFeeChart` | No | 0% |
| `dashboardController.getClassPerformance` | No | 0% |
| `buildDailyTrend(rows, days)` (private utility) | No | 0% |
| `calcAveragePercentage(trend)` (private utility) | No | 0% |
| `relativeTime(d)` (private utility) | No | 0% |
| Route RBAC enforcement (`requireRoles`) | No | 0% |

### Frontend — `packages/frontend/src/pages/dashboard/`

No `__tests__` directory or `.spec.tsx` / `.test.tsx` files exist for the dashboard page. Zero component tests have been written.

| Component / Hook | Test File Exists | Coverage |
|---|---|---|
| `DashboardPage` component | No | 0% |
| `KPICard` component | No | 0% |
| `KPICardSkeleton` component | No | 0% |
| `ChartSkeleton` component | No | 0% |
| `ActivityRowSkeleton` component | No | 0% |
| `activityIcon(type)` utility | No | 0% |
| `barColor(pct)` utility | No | 0% |
| Socket + REST activity feed merge logic | No | 0% |
| Empty state rendering (`isEmpty` branch) | No | 0% |
| `dashboardApi` service functions | No | 0% |

**Overall test coverage: 0%.** This is well below the project-mandated minimum of 70%.

---

## 2. Edge Cases Identified

The following edge cases have no test coverage and must be verified:

### Backend Edge Cases

**EC-001: Empty tenant (zero students)**
- `getOverview`: `activeStudents = 0`, so `todayPct` correctly returns 0. However, `byClass` will be an empty array. The `classNameMap` lookup will not be exercised. Needs verification that all numeric totals default to zero correctly.
- `getClassPerformance`: Returns early with `[]` when `classes.length === 0`. Correct, but must be tested with classes present but zero active students — the `studentsByClass` map will be empty and `studentCount` will silently be 0 for every class.
- `getFeeChart`: With no fee records, all three maps (`collected`, `outstanding`, `overdue`) will be empty. `monthlyData` will return an array of entries all at `0` values. This is technically correct but the frontend will still render the fee collection trend chart (non-empty `feeChart.monthlyData`), potentially confusing users with a flat zero chart rather than the "no data" empty state.

**EC-002: Students enrolled but zero attendance records**
- `buildDailyTrend` will produce `days` entries all with `percentage: 0` and `total: 0`. `calcAveragePercentage` correctly returns 0 because `activeDays.length === 0`. The frontend attendance chart will show a flat zero line rather than the "no data" message — this is a UX defect (see Bug section).

**EC-003: Redis unavailable (cache miss path)**
- Both `getOverview` read and write failures silently catch and continue. The cache write failure on line 322–325 is handled. However, there is no metrics or logging on cache misses, making it impossible to diagnose Redis outages in production without external monitoring.
- On repeated Redis failures the service will execute all Prisma queries on every request with no throttling. Under load this could saturate the database.

**EC-004: Period parameter validation (invalid values)**
- `getAttendanceChart`: Sending `period=quarterly` correctly returns 400 with the message `period must be one of: week, month, term`. Tested path: valid.
- `getFeeChart`: Sending `period=week` correctly returns 400. Tested path: valid.
- Sending `period=` (empty string): The controller defaults via `?? 'week'` only when the value is `undefined`. An empty string (`""`) will fail the `!== 'week' && !== 'month'...` check and return 400. This is correct but untested.
- Sending `period[]=week` (array injection via query string): Express will parse this as an array. `req.query['period']` will be `string[]`, the cast to `string` will produce `[object Array]`, failing validation. This returns a 400 correctly but is an untested exploit vector.

**EC-005: Large class count (50+ classes in `getClassPerformance`)**
- The function fetches all classes, then all active students for those classes, all attendance rows for 30 days, and all fee records — all in a single 3-way `$transaction`. With 50 classes, thousands of students, and 30 days of attendance, this transaction can return tens of thousands of rows in one call. No pagination or batching exists. Memory pressure and query timeout risk is high.
- The bar chart height formula `Math.max(180, classPerformance.length * 36)` at 50 classes renders a 1800px chart inside a `lg:col-span-2` card. This will overflow the viewport and break the layout on any screen size.

**EC-006: Concurrent requests hitting the same cache key**
- If two requests arrive simultaneously for the same `tenantId` when the cache is empty, both will miss the cache, both will execute all Prisma queries, and both will write to Redis. This is a cache stampede. There is no lock or single-flight mechanism. Under high concurrency (e.g., many teachers opening the dashboard at school start time) this will cause duplicate heavy DB load.

**EC-007: Frontend — TEACHER role accessing fee data**
- The `/dashboard/fee-chart` endpoint explicitly excludes `UserRole.TEACHER` from `requireRoles`. A TEACHER calling this endpoint from the frontend will receive a 403.
- However, the `DashboardPage` component unconditionally calls `dashboardApi.feeChart('month')` regardless of the authenticated user's role. This means every TEACHER will trigger a 403 error on page load. The error is silently suppressed by TanStack Query's default behavior, but `feeChart` will be `undefined`, and the fee collection trend section will not render (correctly gated by `feeChart && feeChart.monthlyData.length > 0`). However, the 4th KPI card ("Fee Collection") uses `overview?.fees.collectionPercentage` which comes from the `/overview` endpoint — and the TEACHER role IS permitted on `/overview`. So fee percentage is visible to teachers from the overview but the fee chart is not. This inconsistency in what financial data teachers can see should be clarified as a product decision and the unnecessary 403 API call eliminated.

**EC-008: Socket events arriving before REST data loads**
- `newSocketEvents` is derived from `socketEvents.slice(0, socketEvents.length - processedCountRef.current)`.
- On first render, `processedCountRef.current = 0` and `socketEvents` may already contain events (if socket connected before component mounted). This correctly captures all events.
- If socket events arrive while `overviewLoading` is still `true`, `restActivity` will be `[]`, so `activityFeed` will show only socket events. The activity feed section is guarded by `!isEmpty` (not by `!overviewLoading`), so it will render skeleton rows while `overviewLoading` is true. However, once the overview loads and sets `isEmpty = false`, the feed will appear correctly. No race condition bug here, but the snapshot is not stable during the load window.
- Edge case: if the user's tenant has no students (isEmpty = true), the entire activity feed section is hidden including live socket events. A real check-in event arriving for an empty-looking tenant will be silently dropped from the UI.

### Frontend-Specific Edge Cases

**EC-009: `overview` is `undefined` when REST query errors**
- All four queries lack `onError` handlers. If the network request fails, `overview` will be `undefined`. The JSX uses optional chaining (`overview?.students.total`) and fallbacks (`?? '—'`) consistently, so the UI will not crash. But there is no error toast and no error UI state — the user sees skeleton loaders indefinitely (because `isLoading` becomes `false` but the data stays `undefined`). This is a silent failure.

**EC-010: `feeDonutData` when `byStatus` object contains unexpected keys**
- `byStatus` is typed as `Record<string, number>`. If an unknown status string comes from the backend, `t('finance.status.${entry.name}', { defaultValue: entry.name })` will fall back to the raw key, which is acceptable. No crash risk.

---

## 3. Manual Test Checklist

### Backend API Endpoints

#### GET `/v1/dashboard/overview`
- [ ] Authenticated as SCHOOL_ADMIN — expect 200 with full payload
- [ ] Authenticated as PRINCIPAL — expect 200
- [ ] Authenticated as TEACHER — expect 200
- [ ] Authenticated as ACCOUNTANT — expect 200
- [ ] Authenticated as PARENT — expect 403
- [ ] Authenticated as STUDENT — expect 403
- [ ] No auth token — expect 401
- [ ] With empty tenant (zero students, zero attendance, zero fees) — verify all numeric fields are 0, `recentActivity` is `[]`, `byClass` is `[]`
- [ ] With students but no attendance — verify `attendance.today.percentage` is 0, `notMarked` equals `activeStudents`
- [ ] Verify Redis cache key `dashboard:overview:{tenantId}` is set after first call (TTL = 60s)
- [ ] Verify second call within 60s returns cached result (check response time difference)
- [ ] Simulate Redis down — verify endpoint still returns 200 (fallback to DB)

#### GET `/v1/dashboard/attendance-chart?period={period}`
- [ ] `period=week` — expect 200, `dailyTrend` has 7 entries
- [ ] `period=month` — expect 200, `dailyTrend` has 30 entries
- [ ] `period=term` — expect 200, `dailyTrend` has 90 entries
- [ ] `period=quarterly` (invalid) — expect 400, error code `BAD_REQUEST`
- [ ] `period=` (empty string) — expect 400
- [ ] No `period` param — expect 200 with default `week`
- [ ] TEACHER role — expect 200 (TEACHER is permitted)
- [ ] PARENT role — expect 403

#### GET `/v1/dashboard/fee-chart?period={period}`
- [ ] `period=month` — expect 200
- [ ] `period=quarter` — expect 200
- [ ] `period=year` — expect 200
- [ ] `period=week` (invalid) — expect 400
- [ ] No `period` param — expect 200 with default `month`
- [ ] TEACHER role — expect 403 (TEACHER is excluded)
- [ ] SCHOOL_ADMIN role — expect 200
- [ ] ACCOUNTANT role — expect 200

#### GET `/v1/dashboard/class-performance`
- [ ] Tenant with zero classes — expect 200 with empty array `[]`
- [ ] Tenant with classes but zero active students — expect 200, all `studentCount` = 0
- [ ] Tenant with 50+ classes — verify response time is under 3 seconds
- [ ] TEACHER role — expect 200
- [ ] PARENT role — expect 403

### Frontend Loading States

- [ ] Navigate to dashboard — verify all 4 KPI cards show `KPICardSkeleton` components during load
- [ ] Verify attendance trend card shows `ChartSkeleton` at `height={220}` during load
- [ ] Verify fee donut card shows `ChartSkeleton` at `height={220}` during load
- [ ] Verify class performance card shows `ChartSkeleton` at `height={220}` during load
- [ ] Verify activity feed shows 5 `ActivityRowSkeleton` rows during load
- [ ] Confirm no content layout shift (CLS) between skeleton and real data

### Frontend Empty State

- [ ] Tenant with zero students — verify the dashed border empty state block renders ("No students enrolled yet")
- [ ] Verify "Add Student" CTA button inside empty state is visible and clickable
- [ ] Verify KPI row, charts, activity feed are NOT rendered when `isEmpty = true`
- [ ] Verify empty state disappears after the first student is enrolled and the 60-second refetch fires

### Chart Rendering with Real Data

- [ ] Attendance AreaChart — verify x-axis shows weekday labels (Mon, Tue, etc.), y-axis shows 0%–100%
- [ ] Attendance chart tooltip — hover a data point, verify tooltip shows percentage with 1 decimal place
- [ ] Fee donut PieChart — verify segments appear for each status in `byStatus`
- [ ] Fee donut legend — verify color swatches match segments, labels use translated `finance.status.*` keys
- [ ] Class performance BarChart — verify bars are green (>=75%), amber (>=50%), red (<50%)
- [ ] Class performance label list — verify percentage labels appear to the right of bars
- [ ] Fee collection trend AreaChart — verify two areas (collected/overdue), correct colors (green/red)
- [ ] Fee collection trend Y-axis — verify labels use `formatETB` currency format
- [ ] All charts — verify `var(--border)` grid lines respect dark mode theme

### Activity Feed (Socket + REST merge)

- [ ] Load dashboard — verify REST activity items appear in feed (check-ins, payments, enrollments)
- [ ] Trigger a live RFID check-in event — verify it prepends to the feed immediately without page reload
- [ ] Verify socket items use translated labels (`t('attendance.live.checkin_label')` = "In" / "ገቡ")
- [ ] Verify feed is capped at 20 items (socket events fill first, REST fills remainder)
- [ ] Disconnect network — verify no crash, feed retains last known state
- [ ] Verify empty feed state shows `t('attendance.live.no_events')` text

### i18n Switching (EN to AM)

- [ ] Switch language to Amharic — verify all dashboard section titles switch (welcome, KPI labels, chart titles, activity feed header)
- [ ] Verify KPI values (numbers, percentages) do not display Amharic numerals (they should remain Latin)
- [ ] Verify "Fee Status Distribution" donut legend uses Amharic status labels (ተከፍሏል, ጊዜ አልፎበታል, etc.)
- [ ] Verify no i18n key fallback strings (raw dotted keys) are visible in Amharic mode
- [ ] Verify Amharic text does not overflow KPI card labels at mobile (375px) width

### Dark Mode Rendering

- [ ] Toggle to dark mode — verify KPI card icon backgrounds use dark variants (`dark:bg-blue-950`, etc.)
- [ ] Verify chart grid lines use `var(--border)` (not hardcoded light color)
- [ ] Verify tooltip backgrounds match dark surface (border uses `var(--border)`)
- [ ] Verify `bg-muted` activity feed icon circles are visible in dark mode
- [ ] Verify empty state dashed border is visible in dark mode

### Responsive Layout

- [ ] **Mobile (375px):** Verify KPI row stacks to single column (`grid-cols-1`), no horizontal overflow
- [ ] **Mobile (375px):** Verify action buttons in header wrap correctly (`flex-wrap`)
- [ ] **Mobile (375px):** Verify charts do not overflow — `ResponsiveContainer width="100%"` should constrain
- [ ] **Tablet (768px):** Verify KPI cards show 2-column layout (`sm:grid-cols-2`)
- [ ] **Tablet (768px):** Verify charts row stacks vertically (single column before `lg:` breakpoint)
- [ ] **Desktop (1440px):** Verify 4-column KPI row, 3-column chart layouts render correctly
- [ ] **50+ classes:** Verify class performance bar chart at `classPerformance.length * 36` height does not break the card layout

---

## 4. Potential Bugs

### BUG-001: Dual import of `useTranslation` (dead code / confusion risk)
**File:** `DashboardPage.tsx`, lines 3 and 29
**Severity:** Low
**Description:** `useTranslation` is imported from `react-i18next` twice — once as `useTranslation` and once aliased as `useI18n`. The alias `useI18n` is never used. The component only uses `const { t } = useTranslation()` from the first import. The second import is dead code that will confuse future developers and may cause lint warnings.

### BUG-002: TEACHER role fetches `/fee-chart` endpoint it cannot access (unnecessary 403)
**File:** `DashboardPage.tsx`, line 158–162; `dashboard.routes.ts`, line 32–40
**Severity:** Medium
**Description:** The TEACHER role is excluded from the `/fee-chart` route by `requireRoles`, but `DashboardPage` unconditionally calls `dashboardApi.feeChart('month')` for all roles. Every TEACHER page load will produce a silent 403 error. The fee chart section does not render (correctly gated), but the wasted network request and console error are undesirable. The fee KPI card still shows fee data (from the overview endpoint, which TEACHERs can access), creating an inconsistency in access control visibility.

### BUG-003: Attendance chart renders flat zero line instead of "no data" message when tenant has students but no attendance records
**File:** `DashboardPage.tsx`, lines 308–358
**Severity:** Medium
**Description:** The attendance chart empty-state guard is `attendanceChart && attendanceChart.dailyTrend.length > 0`. When there are no attendance records, `buildDailyTrend` still returns an array of `days` entries (all with `percentage: 0`), so `dailyTrend.length` is 7 (or 30 or 90). The condition is `> 0` so the chart renders a flat zero line. The "No data yet" fallback message never appears for a tenant with students but no attendance. This is misleading.

### BUG-004: Fee collection trend chart renders zero-value chart instead of "no data" when there are no fee records
**File:** `DashboardPage.tsx`, lines 523–591
**Severity:** Low
**Description:** The fee chart section is gated by `feeChart && feeChart.monthlyData.length > 0`. `getFeeChart` always returns `monthlyData` with entries for every month in the period (all at `0`), so `monthlyData.length` is always > 0. The "no data" path is unreachable unless the API returns an error. Users with no fee records will see a flat zero area chart.

### BUG-005: `activityIcon` lookup uses wrong keys for API-sourced activity types
**File:** `DashboardPage.tsx`, lines 121–131
**Severity:** Low
**Description:** The `ICON_MAP` is keyed on `'attendance'`, `'fee'`, `'student'`. However, REST activity items from the API carry `type` values of `'ATTENDANCE_CHECKIN'`, `'FEE_PAYMENT'`, and `'NEW_STUDENT'` (set in `dashboard.service.ts` lines 263, 274, 284). None of these match the ICON_MAP keys, so all REST activity items will display the fallback `<Bell>` icon. Only socket-injected events (which set `type: 'attendance'`) will show the correct icon.

### BUG-006: `getOverview` runs two separate Prisma transactions for student data (potential inconsistency)
**File:** `dashboard.service.ts`, lines 117–131
**Severity:** Medium
**Description:** Student counts and student details are fetched in two separate `$transaction` calls (lines 117–123 and 126–131). A student could be enrolled between these two calls, causing `totalStudents` to be out of sync with `activeStudentDetails`. In a busy production environment this can produce dashboard numbers that do not add up (e.g., `byClass` count sum does not equal `active`). Both fetches should be in a single transaction.

### BUG-007: `todayNotMarked` can be negative if attendance records exist for non-active students
**File:** `dashboard.service.ts`, line 176
**Severity:** Low
**Description:** `todayNotMarked = Math.max(0, activeStudents - todayMarked)`. The `todayMarked` count includes attendance records for all students (not just active ones — there is no `status: ACTIVE` filter on the attendance query). If inactive students have attendance records (historical data or manual entries), `todayMarked` can exceed `activeStudents`, which `Math.max(0, ...)` silently masks. The result is `notMarked = 0` when it should reflect actual unrecorded active students. The fix would be to filter attendance by `student: { status: StudentStatus.ACTIVE }`.

### BUG-008: `relativeTime` is computed at cache-write time, not cache-read time
**File:** `dashboard.service.ts`, lines 46–55, 321–325
**Severity:** Medium
**Description:** Relative time strings (e.g., "3 mins ago") are computed when the result is first built and then frozen in the Redis cache for 60 seconds. When a cached response is served, the relative timestamps are up to 60 seconds stale. A check-in that happened "just now" will still say "just now" for the full cache TTL. This is a known trade-off but should be documented. One mitigation is to store raw timestamps in the cache and compute relative strings at response time in the controller.

### BUG-009: Month ordering in `getFeeChart` is locale-dependent
**File:** `dashboard.service.ts`, line 392
**Severity:** Low
**Description:** `allMonthsOrdered` is built by iterating `dayStart(-i)` and computing `monthLabel`. The `monthLabel` function uses a hardcoded English month abbreviation array. This is correct for display, but because the service runs on the server where locale is irrelevant, this works. However, if the frontend's `formatETB` or any future localized month label function is applied on top, there is a risk of key mismatch between what `collected/outstanding/overdue` maps contain (e.g., "Mar 2026") and what `allMonthsOrdered` generates. Currently consistent, but fragile.

### BUG-010: `useRef` for socket event tracking does not trigger re-render
**File:** `DashboardPage.tsx`, lines 142–185
**Severity:** Medium
**Description:** `processedCountRef.current` is mutated directly (line 172) without a state update. The `newSocketEvents` derivation on line 171 runs on every render, but if `socketEvents` changes (new events arrive) and no other state change triggers a render, the new events will not appear in the UI until the next render cycle. If `socketEvents` update causes the parent hook to re-render the component, this is fine. But if `useAttendanceSocket` returns a mutable array reference that is updated in-place without triggering a React state update, new socket events will be silently lost until the next render from another source (e.g., the 60-second overview refetch).

---

## 5. Performance Notes

### PERF-001: `getOverview` executes 9–10 Prisma queries across 4 separate transactions
**Impact:** High
`getOverview` runs four `prisma.$transaction()` calls sequentially (not in parallel): student counts (4 queries), student details (1 query), attendance status counts (5 queries), weekly+monthly attendance rows (2 queries), fee rows (1 query), recent activity (3 queries). The class name resolution runs as an additional `findMany` outside any transaction. Total: approximately 17 individual database round-trips per cache miss. These could be significantly reduced by combining into fewer transactions or using a single transaction with all queries.

### PERF-002: `getClassPerformance` loads entire attendance and fee history into memory
**Impact:** High
For a tenant with 50 classes, 2000 students, and 30 days of attendance at 90% marking rate, `attendanceRows` could contain ~54,000 records. `feeRows` could contain thousands of records (one per student per fee structure). All of these are loaded into memory and processed with JavaScript Maps. This is an N-record in-memory aggregation that should instead use `GROUP BY` at the database level via Prisma's `groupBy` or raw SQL aggregate queries.

### PERF-003: No index on `Attendance.checkInTime` (recent activity query)
**Impact:** Medium
`recentCheckIns` orders by `checkInTime: 'desc'` with `checkInTime: { not: null }`. The schema defines indexes on `[tenantId]` and `[tenantId, date]` but not on `checkInTime`. This query will require a full scan of all attendance records for the tenant filtered and sorted in memory. As attendance volume grows (months of data), this will become very slow.

### PERF-004: Fee collection trend (`getFeeChart`) loads all fee records filtered only by `dueDate >= periodStart`
**Impact:** Medium
For a `year` period, this includes 365 days of fee records. For a large school with 2000 students and multiple fee structures, this could be tens of thousands of records. Aggregation should happen in the database using `GROUP BY DATE_TRUNC('month', due_date)`.

### PERF-005: `DashboardPage` fires 4 independent `useQuery` calls on mount
**Impact:** Low
All four queries fire simultaneously on component mount, creating 4 concurrent HTTP requests. This is acceptable for a dashboard but could be optimized with a single aggregated endpoint or `Promise.all` pattern if latency becomes noticeable.

### PERF-006: Class performance chart height grows unbounded
**Impact:** Medium
The bar chart height is `Math.max(180, classPerformance.length * 36)`. At 50 classes this is 1800px. At 100 classes (unlikely but possible for large school networks) this is 3600px. There is no scroll container or maximum height cap on the chart. The card will stretch the entire page layout.

### PERF-007: `refetchInterval: 60_000` on overview query is not paused when tab is hidden
**Impact:** Low
TanStack Query's `refetchInterval` defaults to running even when the browser tab is hidden unless `refetchIntervalInBackground: false` is set. A teacher leaving the dashboard tab open will silently hit the overview endpoint every 60 seconds indefinitely, bypassing Redis cache for the backend. Consider setting `refetchIntervalInBackground: false`.

---

## 6. Summary

### Overall Assessment

The Phase 6 dashboard module has solid structural design: the service layer is well-decomposed, the controller correctly validates period parameters, Redis caching is in place with graceful fallback, and the frontend uses proper shadcn components, TanStack Query, skeleton loaders, and i18n. The type system is consistent between backend and frontend (the `DashboardOverview` interface is duplicated rather than shared from a `packages/shared` module, which is a maintenance risk).

However, the module ships with **zero automated test coverage** against the project-mandated 70% minimum, several logic bugs (most critically the activity icon mismatch, the unnecessary 403 for TEACHER role, and the two-transaction student data inconsistency), significant performance risks under real-world data volumes (in-memory aggregation of 50K+ rows), and multiple Amharic translation keys that are either missing from the `am.json` locale or still showing English-only `🇪🇹`-prefixed placeholder strings.

### Risk by Area

| Area | Risk | Reason |
|---|---|---|
| Test Coverage | CRITICAL | 0% coverage, no test infrastructure |
| Data Correctness (getOverview) | HIGH | Two-transaction inconsistency, todayNotMarked can be wrong |
| Performance (getClassPerformance) | HIGH | In-memory aggregation of all attendance/fee data |
| TEACHER role / fee-chart 403 | MEDIUM | Silent error on every teacher dashboard load |
| Activity feed icons | MEDIUM | All REST activity items show wrong (Bell) icon |
| i18n Completeness | MEDIUM | ~30% of Amharic keys are placeholder strings with emoji flags |
| Attendance chart empty state | MEDIUM | Flat zero line shown instead of "no data" message |
| Cache stampede | MEDIUM | No single-flight protection on Redis miss |
| Frontend error states | MEDIUM | No error UI when queries fail — silent indefinite skeleton |
| Relative time in cache | LOW | Timestamps stale up to 60s |

### Risk Rating: HIGH

Deployment to production is not recommended until:
1. Automated test coverage reaches at least 70% (unit tests for service utilities, integration tests for all 4 endpoints).
2. BUG-005 (activity icon mismatch) is fixed — this is immediately visible to all users.
3. BUG-002 (TEACHER 403 on fee-chart) is resolved — the unnecessary error call should be role-gated on the frontend.
4. BUG-006 (two separate student transactions) is corrected to prevent count inconsistencies.
5. PERF-002 (in-memory class performance aggregation) is replaced with database-level GROUP BY before the module is used with more than ~500 students.
6. Amharic i18n placeholders (`🇪🇹`-prefixed strings) are completed before any Amharic-locale tenant is onboarded.
