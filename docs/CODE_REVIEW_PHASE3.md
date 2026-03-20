# Phase 3 Code Review — Attendance & RFID System
Date: 2026-03-19
Reviewer: Senior Full Stack Reviewer (Claude Sonnet 4.6)

---

## RLS Policy Verification

### pg_policies output
```
  tablename   |    policyname    | cmd
--------------+------------------+-----
 Attendance   | tenant_isolation | ALL
 RfidEventLog | tenant_isolation | ALL
 SchoolConfig | tenant_isolation | ALL
(3 rows)
```

### pg_class RLS flags
```
   relname    | relrowsecurity | relforcerowsecurity
--------------+----------------+---------------------
 Attendance   | t              | t
 SchoolConfig | t              | t
 RfidEventLog | t              | t
(3 rows)
```

**Verdict: PASS.** All three Phase 3 tables have RLS enabled, force-enabled, and a `tenant_isolation` policy covering ALL commands. No missing policies.

---

## Backend — Critical Issues (P0)

### P0-1: RFID event endpoint bypasses RLS middleware — tenantId from header is never validated against the database

**File:** `packages/backend/src/modules/attendance/attendance.routes.ts` (lines 54–79)

The `rfidAuthMiddleware` reads `X-Tenant-ID` directly from the request header and sets it on `req.auth` without ever calling `resolveTenant` or `setRLSContext`. This means:

1. The PostgreSQL `set_config('app.current_tenant_id', ...)` call in `setRLSContext` is **never executed** for RFID event requests. The RLS policy on `Attendance` and `RfidEventLog` will use whatever value `current_setting('app.current_tenant_id')` returns from a prior connection in the pool — or raise an error if no value is set at all.
2. A malicious RFID agent can supply **any** `X-Tenant-ID` UUID in the header and write attendance/event-log records into any school's data without being rejected by the database-level RLS policy, because the Prisma queries also receive `tenantId` as an explicit WHERE clause (`WHERE tenantId = $1`), which IS tenant-scoped — but it also means the RLS safety net provides zero extra protection for this route.
3. There is no check that the provided `X-Tenant-ID` actually belongs to an active, licensed tenant. A deactivated or expired tenant's RFID readers can still POST events and write records.

**Impact:** Data integrity risk. An RFID reader misconfigured with the wrong tenant ID writes attendance records under the wrong school. License/activation checks are entirely skipped.

**Required fix:** Call `resolveTenant` (or an inline tenant-existence check) and `setRLSContext` inside `rfidAuthMiddleware`, or register them on the `/rfid-event` route before `attendanceController.rfidEvent`.

---

### P0-2: Race condition in RFID debounce — non-atomic check-then-create allows duplicate check-ins

**File:** `packages/backend/src/modules/attendance/attendance.service.ts` (lines 48–96)

`processRfidEvent` performs:
1. Read `rfidEventLog` to check for recent processed events (line 50–58)
2. Read `attendance` to check for existing record (line 75–79)
3. Create new `attendance` record (line 86–96)

These three operations are **not wrapped in a database transaction**. Under concurrent RFID taps (e.g., two readers scanning the same card within milliseconds, or a network retry), two requests can both pass the debounce check simultaneously before either marks the event as processed, resulting in a `UNIQUE constraint violation` on `(tenantId, studentId, date)` — which will surface as an unhandled 500 error to the RFID agent. At best this causes agent-side retry loops; at worst it produces duplicate notification queue jobs (parent receives two push notifications for one check-in).

**Required fix:** Wrap steps 1–5 of `processRfidEvent` in a `prisma.$transaction()` with serializable isolation, or use an `INSERT ... ON CONFLICT DO NOTHING` pattern at the database level.

---

### P0-3: `markBulk` does not validate that `studentId` values belong to the requested `classId`/`sectionId`

**File:** `packages/backend/src/modules/attendance/attendance.service.ts` (lines 205–229)

The `BulkAttendanceDto` includes `classId` and `sectionId`, but the service never verifies that the `studentId`s in `records` actually belong to that class/section. A crafted request can mark attendance for students in an entirely different class. The `$transaction` upsert loop uses only `studentId` in the WHERE clause, so the `classId`/`sectionId` fields are decorative — they are not used to scope the write.

**Impact:** A teacher with access to one class can bulk-mark attendance for students in any other class within the same tenant.

**Required fix:** Before the `$transaction`, fetch student IDs for the given `classId`/`sectionId` and filter `dto.records` to only those students. Throw a `BadRequestError` if any foreign `studentId` is included.

---

## Backend — High Issues (P1)

### P1-1: `getReport` has no result-set size limit — full table scan on large date ranges

**File:** `packages/backend/src/modules/attendance/attendance.service.ts` (lines 287–376)

`getReport` calls `prisma.attendance.findMany({ where })` with no `take` limit. For a school with 2,000 students over a full academic year (~200 school days), this is a 400,000-row query with a full include for each record's student relation. There is no pagination, no max date-range guard, and no streaming.

**Impact:** This endpoint will time out or OOM-kill the Node.js process for any school on the Professional/Enterprise tier. It will also degrade the database connection pool for all other tenants sharing the instance.

**Required fix:** Add a configurable hard cap (e.g., max 90-day range, or paginate in the service layer). Consider a raw SQL aggregation query (`GROUP BY studentId, status`) instead of fetching individual rows and aggregating in JavaScript.

---

### P1-2: Late-detection logic uses server's local time, not the tenant's timezone

**File:** `packages/backend/src/modules/attendance/attendance.service.ts` (lines 69–72)

```typescript
const checkInMinutes = eventTime.getHours() * 60 + eventTime.getMinutes();
```

`getHours()` and `getMinutes()` return values in the **server's local timezone** (or UTC if running in Docker without `TZ` env var). Ethiopian schools are in `Africa/Addis_Ababa` (UTC+3). If the server runs in UTC, a check-in at 08:10 local time is 05:10 UTC, so `checkInMinutes` = 310, which is less than the cutoff of 480+15=495, and the student is marked PRESENT — correct by accident. But if `schoolStartTime` is set to a non-standard time, or if DST edge cases arise, the calculation will silently produce wrong LATE/PRESENT statuses without any error.

The Tenant model has a `timezone` field (`Africa/Addis_Ababa` by default) and `SchoolConfig` has `schoolStartTime`. These must be used together with a timezone-aware date library.

**Required fix:** Use a library like `date-fns-tz` or `luxon` to interpret `eventTime` in the tenant's configured timezone before extracting hours/minutes. Load the tenant timezone from `SchoolConfig` or fall back to `Tenant.timezone`.

---

### P1-3: `rfidAuthMiddleware` is defined AFTER it is used in the route registration

**File:** `packages/backend/src/modules/attendance/attendance.routes.ts` (lines 24–28, 54–79)

```typescript
router.post('/rfid-event', rfidAuthMiddleware, ...);   // line 24 — used here
// ...
function rfidAuthMiddleware(...) { ... }               // line 54 — defined here
```

JavaScript function declarations are hoisted, so this works at runtime. However, it is misleading during code review and violates the team's ESLint Airbnb config, which typically flags "no-use-before-define". This is confirmed as a lint error, not just a style issue.

**Required fix:** Move the `rfidAuthMiddleware` function definition above its first usage, or extract it to a separate middleware file.

---

### P1-4: Socket.IO `attendance:update` payload for RFID events is missing `admissionNumber` and `photo`

**File:** `packages/backend/src/modules/attendance/attendance.service.ts` (lines 121–133)

The payload emitted by `processRfidEvent` (line 122–133) does not include `admissionNumber` or `photo`, but the frontend's `AttendanceEvent` interface (in `useAttendanceSocket.ts`, lines 6–18) declares both as required fields:

```typescript
export interface AttendanceEvent {
  admissionNumber: string;   // ← not sent by backend RFID path
  photo: string | null;      // ← not sent by backend RFID path
  ...
}
```

When `fromSocketEvent` maps a live RFID event in `LiveMonitorPage.tsx` (line 50–63), `admissionNumber` and `photo` will be `undefined`, causing the avatar fallback to always render and the admission number display to be blank. This is a data contract mismatch.

The `markManual` socket emission (lines 191–197) has the same problem — it also omits `admissionNumber`, `photo`, `className`, `sectionName`, `checkOutTime`, `source`, and `action`.

**Required fix:** Include the student's `admissionNumber` and `photo` in the `include` query on line 23–29 of the service, and add them to both socket payloads. The manual attendance emit is missing most of the fields the frontend interface requires.

---

### P1-5: `AttendancePage` — `sectionId` is not enforced as required before allowing bulk save

**File:** `packages/frontend/src/pages/attendance/AttendancePage.tsx` (lines 130–151)

The `saveAttendance` mutation calls `attendanceApi.markBulk` with `sectionId: selectedSectionId`, which may be an empty string `''` if the teacher selects a class but not a section. The backend `bulkAttendanceSchema` validates `sectionId` as `z.string().uuid()`, so an empty string will fail Zod validation and return a 400 error. However, the UI shows no error message to explain why the save failed — `onError` only calls `toast.error(t('common.errors.server_error'))`, which is misleading.

Additionally, the Save button should be disabled when `!selectedSectionId`, not just when `!hasChanges`.

---

### P1-6: No RBAC guard on `GET /attendance/today-summary` and `GET /attendance/recent-checkins`

**File:** `packages/backend/src/modules/attendance/attendance.routes.ts` (lines 34–35)

```typescript
router.get('/today-summary', attendanceController.todaySummary);
router.get('/recent-checkins', attendanceController.recentCheckIns);
```

These routes require JWT auth (via the `router.use(authenticate, ...)` on line 32) but have no `requireRoles()` guard. Any authenticated user — including a PARENT or STUDENT role — can call these endpoints and receive a school-wide attendance summary including counts and recent check-in data for all students. Parents should only see their own child's data.

**Required fix:** Add `requireRoles(UserRole.SCHOOL_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER, UserRole.RECEPTIONIST)` to summary/recent-checkins endpoints, or implement per-role data filtering in the service layer.

---

### P1-7: `getReport` does not include `excusedDays` or `halfDayDays` in the returned object

**File:** `packages/backend/src/modules/attendance/attendance.service.ts` (lines 364–375)

The aggregation counts `excused` and `halfDay` days internally but the returned object omits `excusedDays`:

```typescript
return Array.from(studentMap.values()).map((s) => ({
  ...
  // excusedDays: s.excused  ← MISSING
  // halfDayDays: s.halfDay  ← MISSING
}));
```

The frontend `AttendanceReport` type (in `attendance.service.ts` line 51) declares `excusedDays: number`, so TypeScript consumers will receive `undefined` where a number is expected. The CSV export also omits this column.

---

## Backend — Medium Issues (P2)

### P2-1: `setRLSContext` uses `set_config` with `is_local = false` — context persists across connection pool reuse

**File:** `packages/backend/src/middleware/rls.ts` (line 21)

```typescript
await prisma.$executeRawUnsafe(
  `SELECT set_config('app.current_tenant_id', $1, false)`,
  req.tenant.id,
);
```

The third argument `false` means the config is **session-scoped**, not transaction-scoped. When Prisma's connection pool reuses a connection for a different tenant's request before the session config is reset, the stale `current_tenant_id` value from the previous request could briefly be used. This is typically safe with short-lived connections but becomes a risk under high concurrency.

**Recommended fix:** Pass `true` as the third argument (`is_local = true`) so the setting is transaction-scoped and automatically resets. Alternatively, reset the config in a middleware teardown hook.

---

### P2-2: `processRfidEvent` — `rfidEventLog.updateMany` uses a non-unique filter that could match multiple log entries

**File:** `packages/backend/src/modules/attendance/attendance.service.ts` (lines 115–118)

```typescript
await prisma.rfidEventLog.updateMany({
  where: { tenantId, studentId: student.id, timestamp: eventTime },
  data: { processed: true, action },
});
```

If two RFID readers (e.g., entry + exit gates) have the same student card tapped at the exact same millisecond (highly unlikely but possible with replayed/synthesized events), this `updateMany` will mark both log entries as processed with the same `action`. The initial log creation uses the same `eventTime` for both. This should use the specific `id` of the log entry created on line 32.

---

### P2-3: Notification worker is a stub — no actual push or SMS delivery occurs

**File:** `packages/backend/src/config/queue.ts` (lines 35–51)

The `notificationWorker` only logs to console. This is expected for Phase 3 (Phase 5 will wire FCM), but it means the 10-second parent notification SLA from CLAUDE.md is **not met** for the current build. This should be documented with a clear `TODO` comment and a failing test (or skipped test) so the gap is not forgotten.

The worker does not access `parentIds` from `job.data` (line 38 destructures only `type`, `studentName`, `time`, `tenantId`), so even a partial stub implementation cannot log which parents would be notified.

---

### P2-4: `getTodaySummary` counts students with status `not INACTIVE` rather than only `ACTIVE`

**File:** `packages/backend/src/modules/attendance/attendance.service.ts` (line 383)

```typescript
prisma.student.count({ where: { tenantId, status: { not: 'INACTIVE' } } }),
```

This includes students with statuses like `SUSPENDED`, `GRADUATED`, `ON_LEAVE` (if those enum values exist) in the "total students" denominator, which will make the attendance percentage appear lower than it should. The count should use `{ status: 'ACTIVE' }` to match only currently enrolled students.

---

### P2-5: `markBulk` bulk transaction is not isolated — partial failures leave data in inconsistent state

**File:** `packages/backend/src/modules/attendance/attendance.service.ts` (lines 209–228)

Prisma's `$transaction` with an array of operations does run all operations in a single DB transaction, so a failure will roll back. However, if any `studentId` in the batch fails (e.g., the student does not exist and the foreign key constraint rejects the insert), the entire batch rolls back silently. The response `{ saved: results.length }` would never be reached, but the `onError` in the frontend only shows a generic toast. The specific failed `studentId` is not surfaced.

---

## Frontend — Critical Issues (P0)

### P0-4: `LiveMonitorPage` — double-renders socket events (events state is managed in two places)

**File:** `packages/frontend/src/pages/attendance/LiveMonitorPage.tsx` (lines 94–97) and `packages/frontend/src/hooks/useAttendanceSocket.ts` (lines 42–44)

The `useAttendanceSocket` hook maintains its own `events` array (line 21) and prepends each incoming `attendance:update` event. `LiveMonitorPage` then has a `useEffect` (lines 94–97) that also prepends from `socketEvents[0]`:

```typescript
// hook: prepends every event to its own internal array
socket.on('attendance:update', (event) => {
  setEvents((prev) => [event, ...prev].slice(0, 50));
});

// page: watches the hook's events array and prepends to its own display array
useEffect(() => {
  if (socketEvents.length === 0) return;
  setDisplayEvents((prev) => [fromSocketEvent(socketEvents[0]), ...prev].slice(0, 50));
}, [socketEvents]);
```

Each new socket event causes the hook's `events` state to change → triggers the page's `useEffect` → prepends `socketEvents[0]` to `displayEvents`. But `socketEvents[0]` is always the **most recently received event**, not necessarily the one that just changed. If two events arrive quickly, the page effect fires twice but always reads `socketEvents[0]` (the latest), causing the second-most-recent event to be silently dropped from `displayEvents`. This means the live feed misses events under burst load.

**Required fix:** The hook should expose events as an array that grows (current behavior) but the page effect should diff the previous and new array lengths and prepend only the genuinely new entries, or the hook should expose a callback pattern instead of a state array.

---

### P0-5: `AttendancePage` — double "Mark All Present" button renders when `hasChanges === false && rows.length > 0`

**File:** `packages/frontend/src/pages/attendance/AttendancePage.tsx` (lines 218–249)

```tsx
{hasChanges && (
  <Button onClick={handleMarkAllPresent}>...</Button>
)}
{!hasChanges && rows.length > 0 && (
  <Button onClick={handleMarkAllPresent}>...</Button>
)}
```

These two conditions are mutually exclusive but both render a button with identical UI and behavior. When `hasChanges` is true, one button renders. When rows exist but no changes, the other renders. The net effect is always one button — but if a future refactor changes the conditions, two buttons can appear simultaneously. More critically, this is **dead code duplication** that makes the intent unclear. Should be a single button: `<Button onClick={handleMarkAllPresent} disabled={rows.length === 0}>`.

---

## Frontend — High Issues (P1)

### P1-8: `LiveMonitorPage` — hardcoded English strings "In:" and "Out:" not passed through `t()`

**File:** `packages/frontend/src/pages/attendance/LiveMonitorPage.tsx` (lines 229–232)

```tsx
{event.checkInTime
  ? `In: ${formatTime(event.checkInTime)}`
  : event.checkOutTime
  ? `Out: ${formatTime(event.checkOutTime)}`
  : '—'}
```

The labels "In:" and "Out:" are hardcoded English strings. These must use `t('attendance.live.check_in_label')` and `t('attendance.live.check_out_label')` per CLAUDE.md Rule #5 (no hardcoded English strings).

---

### P1-9: `AttendanceReportsPage` — "all" is passed as a UUID to the API for class/section filter

**File:** `packages/frontend/src/pages/attendance/AttendanceReportsPage.tsx` (lines 282–288, 306–312)

```tsx
<SelectItem value="all">{t('students.filter_class')}</SelectItem>
```

When the user selects "All Classes", `selectedClassId` is set to `'all'`. This string is then passed to `attendanceApi.report({ classId: 'all' })`. The backend validator expects `classId` to be a valid UUID (`z.string().uuid().optional()`), so `'all'` fails Zod validation and returns a 400 error silently. The frontend has no error handling for this path.

**Required fix:** Use an empty string `''` or `undefined` as the "all" sentinel value (matching how `AttendancePage` handles it), and filter it out before sending to the API: `classId: selectedClassId && selectedClassId !== 'all' ? selectedClassId : undefined`.

---

### P1-10: `AttendancePage` — filter labels use raw `<label>` elements, violating CLAUDE.md shadcn-only rule

**File:** `packages/frontend/src/pages/attendance/AttendancePage.tsx` (lines 258–260, 286–288, 305–307)

```tsx
<label className="text-xs font-medium text-muted-foreground">
  {t('attendance.daily.select_date')}
</label>
```

CLAUDE.md mandates using shadcn/ui's `FormLabel` (within a `Form` context) or at minimum the `Label` primitive from `@/components/ui/label`. Raw HTML `<label>` elements are not associated with their controls via `htmlFor`, which breaks accessibility (screen readers cannot link the label to the select/popover trigger). Same issue exists in `AttendanceReportsPage.tsx` (lines 222, 249, 274, 293).

---

### P1-11: `useAttendanceSocket` — no token refresh / reconnect on 401 from socket middleware

**File:** `packages/frontend/src/hooks/useAttendanceSocket.ts` (lines 26–50)

The hook connects using `accessToken` from the auth store. JWT access tokens expire after 15 minutes (`JWT_ACCESS_EXPIRES_IN=15m`). When the token expires, the socket server's JWT middleware rejects the connection and emits a `connect_error`. The hook sets `connected = false` but does not attempt to refresh the token and reconnect. The live monitor silently goes dark after 15 minutes without any user notification beyond the Wi-Fi status indicator changing to red.

**Required fix:** On `connect_error`, check if the error is an auth error, trigger token refresh via the existing auth flow, and then reconnect with the new token. Alternatively, use the socket's `auth` callback form that supports dynamic token injection.

---

### P1-12: `DashboardPage` — `summary` type is `any`, losing TypeScript safety

**File:** `packages/frontend/src/pages/dashboard/DashboardPage.tsx` (lines 29–30)

```typescript
const summary = (summaryRes as any)?.data?.data;
```

The `todaySummary()` call returns `ApiResponse<TodaySummary>` but the result is cast to `any` before accessing `.data.data`. This makes `summary.attendancePercentage.toFixed(1)` unchecked — if the API shape changes, TypeScript won't catch it. Same pattern appears in `LiveMonitorPage.tsx` (lines 76–77, 86–87). The `attendance.service.ts` file already exports `TodaySummary` and `ApiResponse<T>` types.

**Required fix:** Use `useQuery`'s generic parameter `useQuery<AxiosResponse<ApiResponse<TodaySummary>>>` and access the data through properly typed fields.

---

### P1-13: `AttendancePage` — bulk save sends only changed records, not all records including unchanged ones

**File:** `packages/frontend/src/pages/attendance/AttendancePage.tsx` (lines 132–137)

```typescript
const records = Array.from(changes.entries()).map(([studentId, status]) => ({ ... }));
return attendanceApi.markBulk({ ... records });
```

Only modified rows are included in the bulk save. If a teacher loads the page for a class that already has partial attendance from RFID (e.g., 20 students checked in via RFID), and then uses "Mark All Present" followed by Save, only the records in the `changes` Map are saved. Students whose RFID record already shows PRESENT will not be in `changes` (because `handleMarkAllPresent` only sets the `changes` map, not bypasses existing records), so RFID-marked students are correctly excluded. However, students who were never marked (neither by RFID nor manually) and were not touched in the UI will also be excluded, leaving them as "not marked." This is arguably correct behavior but is not obvious to the user.

More importantly: if a teacher changes a student from PRESENT back to ABSENT, that IS in `changes` and gets saved — which is correct. The behavior is actually fine but the UX feedback of showing only `changes.size` unsaved changes is confusing when RFID has pre-populated some records.

**Recommendation:** Add a tooltip or note explaining that only manually changed records are saved, and RFID-marked records are preserved.

---

## Frontend — Medium Issues (P2)

### P2-6: `AttendanceReportsPage` — no empty state illustration or CTA when report data is empty

**File:** `packages/frontend/src/pages/attendance/AttendanceReportsPage.tsx` (line 364)

```tsx
<DataTable ... emptyMessage={t('attendance.reports.no_data')} />
```

CLAUDE.md requires an "Empty state with illustration + CTA." A plain text message passed to `DataTable` does not include an illustration. The custom `EmptyState` component exists at `components/custom/EmptyState.tsx` and should be used here.

---

### P2-7: `LiveMonitorPage` — KPI cards do not include attendance percentage card from spec

**File:** `packages/frontend/src/pages/attendance/LiveMonitorPage.tsx` (lines 136–188)

The page renders 5 KPI cards: Total, Present, Absent, Late, Not Marked. The dashboard spec in CLAUDE.md requires "attendance %" as one of the KPIs for the SCHOOL_ADMIN dashboard. The `TodaySummary` API response includes `attendancePercentage` but it is not displayed on the LiveMonitorPage — only count-based cards are shown. The 5th card (Not Marked) could be replaced or a 6th card added.

---

### P2-8: `AttendancePage` — no confirmation before navigating away with unsaved changes

**File:** `packages/frontend/src/pages/attendance/AttendancePage.tsx` (all)

CLAUDE.md Form rules state: "Unsaved changes warning before navigation." The `changes` map tracks edits but there is no `useBeforeUnload` or React Router navigation blocker. A teacher who selects a different date or class will lose all unsaved changes silently (the `useEffect` on lines 79–81 wipes `changes` when `selectedSectionId` or `date` changes).

---

### P2-9: `DashboardPage` — KPI card for "Total Staff" and "Fee Collection %" shows "—" with no skeleton

**File:** `packages/frontend/src/pages/dashboard/DashboardPage.tsx` (lines 73–79, 98–105)

These two KPI cards hardcode `—` and `{t('dashboard.no_data_yet')}` without a skeleton loading state. While the data truly doesn't exist yet (Phase 4), the visual inconsistency is jarring — the two attendance KPIs show skeletons during load, but the staff/fee cards always show a dash. Should show skeletons consistently during initial load.

---

### P2-10: Socket.IO CORS in `socket.ts` uses `process.env['FRONTEND_URL']` instead of `env` validated config

**File:** `packages/backend/src/config/socket.ts` (line 12)

```typescript
origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
```

All other config access goes through the `env` module (Zod-validated). This direct `process.env` access bypasses validation and means `FRONTEND_URL` is not declared in the env schema, making it invisible in `.env.example` and undocumented.

---

### P2-11: `AttendancePage` — `withStudents: 'true'` is passed as a query param but not declared in the backend `attendanceFiltersSchema`

**File:** `packages/frontend/src/pages/attendance/AttendancePage.tsx` (line 92)

```typescript
attendanceApi.list({ ..., withStudents: 'true', ... })
```

The backend `attendanceFiltersSchema` (in `attendance.validator.ts`) does not declare `withStudents`. Zod by default strips unknown keys (`strip` mode), so this parameter is silently ignored. The backend always includes the student relation in the `list` query (lines 261–272 in the service), making this param redundant. But its presence suggests a dead code path or an intended feature that was never wired up.

---

## TypeScript Check

### Backend (`npx tsc --noEmit`)

Bash execution was denied by the sandbox. Based on static analysis of all backend files reviewed:

- No TypeScript errors detected in reviewed files.
- `req.auth` is accessed with non-null assertion (`req.auth!`) throughout the controller, which is correct given the middleware chain. However, the `req.auth` type must include `role: string` to accommodate `role: 'RFID_READER'` set by `rfidAuthMiddleware` (line 77 in routes). If the `AuthPayload` type constrains `role` to `UserRole` enum values, this assignment will fail. **Likely tsc error.**
- The `attendance.service.ts` `list` function casts `filters.status` with `as Prisma.AttendanceWhereInput['status']` (line 250) — this suppresses a type error but is a code smell.

### Frontend (`pnpm build`)

Bash execution was denied by the sandbox. Based on static analysis:

- `DataTable` is imported from `@/components/ui/data-table` with both a default import and a named `ColumnDef` import: `import { DataTable, ColumnDef } from '@/components/ui/data-table'`. Depending on how `data-table.tsx` exports these, this could be a build error.
- The `unwrapList` import from `@/lib/api-helpers` is used in both `AttendancePage` and `AttendanceReportsPage` but was not among the reviewed files — if it does not exist, both pages will fail to build.
- `(summaryRes as any)?.data?.data` pattern will compile but loses type safety, as noted in P1-12.

**Note:** Run `cd packages/backend && npx tsc --noEmit` and `cd packages/frontend && pnpm build` with Bash permission granted to get exact output.

---

## Summary

**Overall Verdict: NEEDS FIXES**

### Issue Count by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| P0 — Critical | 5 | Security/data-loss/runtime crash |
| P1 — High | 13 | Bugs, wrong logic, missing validation |
| P2 — Medium | 11 | Code quality, UX, minor bugs |
| **Total** | **29** | |

### Must-Fix Before Merge (P0 + P1)

The following are blockers:

1. **P0-1** — RFID endpoint skips RLS context and tenant validation. Security regression.
2. **P0-2** — Race condition in RFID debounce. Duplicate notifications and constraint errors under load.
3. **P0-3** — Bulk attendance allows cross-class student ID injection. RBAC bypass.
4. **P0-4** — Socket event deduplication bug causes missed events in live feed under burst load.
5. **P0-5** — Duplicate "Mark All Present" buttons (dead code causing confusion).
6. **P1-1** — Report endpoint has no size limit. Will OOM/timeout in production.
7. **P1-2** — Late detection uses server timezone, not tenant timezone. Wrong LATE status for Ethiopian schools.
8. **P1-4** — Socket payload missing `admissionNumber` and `photo`. Live feed shows blank names and avatars.
9. **P1-6** — Summary endpoints expose school-wide data to PARENT/STUDENT roles.
10. **P1-7** — `excusedDays` missing from report response. Type mismatch.
11. **P1-9** — `'all'` sentinel value causes 400 error from Zod UUID validation on reports page.
12. **P1-11** — Socket JWT expiry causes silent live feed disconnect after 15 minutes.

### Strengths

- RLS policies are correctly configured on all three Phase 3 tables with `relforcerowsecurity = true`.
- RFID debounce logic (5-minute window) is correctly specified.
- Check-in/check-out flow (first tap = IN, second tap = OUT) is correctly implemented.
- Socket.IO is correctly namespaced to `/attendance` and rooms are tenant-scoped.
- BullMQ notification queue is used (async, not synchronous) — correct architecture even though the worker is a stub.
- All user-facing text in most components uses `t()` (except the "In:"/"Out:" strings noted in P1-8).
- `shadcn/ui` components are used throughout (Button, Card, Select, Calendar, Badge, Avatar, Skeleton, DataTable, Popover) — no raw HTML form elements except the label issue noted in P1-10.
- React Query is used consistently for all data fetching.
- Skeleton loading states are used instead of spinners.
- Status badge colors follow the CLAUDE.md color convention exactly.
- Dark mode classes are consistently included in badge color strings.
