# QA Report — Phase 3: Attendance & RFID System
Date: 2026-03-19

## Environment
- Backend: Node.js + Express + Prisma (ts-node-dev)
- DB: PostgreSQL with RLS (schoolsync_app non-superuser, FORCE RLS enforced)
- Test Tenant: addis-international (29 active students, 7 days attendance seeded)

---

## Build Checks

| Check | Result | Notes |
|-------|--------|-------|
| Backend `tsc --noEmit` | **PASS** | Zero errors |
| Frontend `pnpm build` | **PASS** (after fixes) | Required: `pnpm install` + 4 type annotation fixes |

### Frontend build fixes applied
- `pnpm install` needed — `socket.io-client` was declared in package.json but not installed
- Added explicit `Date | undefined` type to Calendar `onSelect` callbacks in `AttendancePage.tsx` (×1) and `AttendanceReportsPage.tsx` (×2)
- Added explicit `number` type to `tickFormatter` in `AttendanceReportsPage.tsx`

---

## Bugs Found & Fixed

### BUG-1 — CRITICAL: Login blocked by RLS (auth route missing setRLSContext)
**File:** `src/modules/auth/auth.routes.ts`
**Root cause:** `User` table has `FORCE ROW LEVEL SECURITY`. The login route called `resolveTenant` but not `setRLSContext`, so `prisma.user.findUnique()` ran on a connection with no tenant context → 0 rows returned → 401 for every valid user.
**Fix:** Added `setRLSContext` middleware to the `/login` route after `resolveTenant`.
**Impact:** ALL logins were failing before this fix.

### BUG-2 — CRITICAL: RFID event returns 500 (RFID route missing setRLSContext)
**File:** `src/modules/attendance/attendance.routes.ts`
**Root cause:** `rfidAuthMiddleware` did not call `setRLSContext`. The `RfidEventLog.create()` and `Student.findFirst()` queries ran without tenant context → RLS blocked every write.
**Fix:** Added `rfidRlsMiddleware` (async, calls `prisma.$executeRawUnsafe` with the tenantId from `req.auth`) as a second middleware in the RFID route chain.

### BUG-3 — CRITICAL: RFID student lookup always returns unknown_card
**File:** `src/modules/attendance/attendance.routes.ts`
**Root cause:** `rfidAuthMiddleware` set `req.auth.tenantId` to the raw `X-Tenant-ID` header value (slug e.g. `addis-international`), NOT the UUID. The service layer passed this slug as `tenantId` to `prisma.student.findFirst({ where: { tenantId, rfidCardNumber } })` — no rows match because DB stores UUIDs.
**Fix:** Made `rfidAuthMiddleware` async and added a Prisma lookup to resolve slug → UUID (same logic as `resolveTenant`). Now `req.auth.tenantId` always contains the UUID.

### BUG-4 — HIGH: todaySummary returns totalStudents = 0 (connection pool RLS)
**File:** `src/modules/attendance/attendance.service.ts`
**Root cause:** `getTodaySummary` used `Promise.all([prisma.student.count(...), ...3 more])`. Each Prisma operation grabs a connection from the pool; `set_config` is session-scoped so only the connection that ran `setRLSContext` has the tenant context. The `student.count` landed on a different pool connection → returned 0.
**Fix:** Changed `Promise.all([...])` to `prisma.$transaction([...])`. This pins all 4 count queries to one connection, ensuring the RLS context is inherited.
**Same fix applied to:** `list()` which used `Promise.all([findMany, count])`.

---

## Test Results

### Test 1 — Seed Data Verification

| Test | Result | Response |
|------|--------|----------|
| 1a Today Summary (Addis) | **PASS** | `totalStudents:29, present:6, notMarked:23, %:21` |
| 1b Recent Check-ins | **PASS** | 1 record (RFID check-in from Test 2a) |
| 1c Attendance list with date range | **PASS** | `total:126` records across 7 days, data returned |
| 1d Attendance report (7 days) | **PASS** | 30 students aggregated with % |

*Note: `totalStudents:29` not 30 — one student was soft-deleted in earlier Phase 2 QA test. Correct behavior.*

### Test 2 — RFID Event Processing

| Test | Result | Response |
|------|--------|----------|
| 2a First tap (CHECK_IN) | **PASS** | `action:CHECK_IN, student:{name:"Dawit Bekele"}, status:LATE` |
| 2b Second tap within 5 min (debounce) | **PASS** | `ignored:true, reason:debounce` |
| 2c Unknown card | **PASS** | `ignored:true, reason:unknown_card` |
| 2d JWT instead of X-Reader-Secret | **PASS** | `401 UNAUTHORIZED: Invalid reader secret` |

*Note: Status=LATE is correct — test ran at 12:48 UTC, school start is 08:00 + 15min grace = 08:15 cutoff.*

### Test 3 — Manual Attendance

| Test | Result | Response |
|------|--------|----------|
| 3a Manual single record | **PASS** | Attendance record created, `source:MANUAL` |
| 3b Bulk attendance (5 students) | **PASS** | `saved:5` |

### Test 4 — Tenant Isolation

| Test | Result | Response |
|------|--------|----------|
| 4a Hawassa attendance list | **PASS** | `data:[], total:0` |
| 4b Hawassa today-summary | **PASS** | All counts = 0 |

### Test 5 — Frontend Build

| Check | Result | Notes |
|-------|--------|-------|
| `pnpm install` | **PASS** | Installed socket.io-client |
| `pnpm build` | **PASS** | 3400 modules, built in 8s |

---

## Root Cause Summary: The RLS + Connection Pool Pattern

The most impactful bugs all share the same root cause: **`set_config` is session-scoped but Prisma uses a connection pool**. Any time multiple Prisma operations run concurrently (`Promise.all`) or a route doesn't call `setRLSContext` before its first query, the pool may return a connection without the tenant context.

### Affected patterns (fixed in this session):
1. Auth login — `setRLSContext` must be called even on public routes that query tenant-scoped tables
2. RFID event route — custom auth middleware must call `set_config` before the first service query
3. Any service method using `Promise.all([prisma.X, prisma.Y])` — use `prisma.$transaction([...])` instead

### Remaining risk (not fixed here — architectural):
`prisma.$transaction([...])` with sequential items is safe. However, any future service method that uses `Promise.all` with cross-table queries will silently return empty data. **Recommendation:** Add an ESLint rule or code review checklist item — "No `Promise.all` with Prisma operations in tenant-scoped services. Use `$transaction` instead."

---

## Credentials Reference

| Tenant | Email | Password | Plan |
|--------|-------|----------|------|
| addis-international | admin@addis.edu.et | Admin@123 | PROFESSIONAL |
| hawassa-academy | admin@hawassa.edu.et | Admin@123 | STARTER |

---

## Overall Verdict: **PASS** (after fixes)

All 13 tests pass. 4 bugs found and fixed (3 CRITICAL, 1 HIGH). The system is functional for Phase 3 scope.
