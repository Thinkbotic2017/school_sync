# CODE_REVIEW_PHASE5B.md — TenantConfig System

**Reviewer:** Senior Full Stack Reviewer
**Phase:** 5B — TenantConfig System
**Date:** 2026-03-20
**Overall Verdict:** CONDITIONAL PASS — 4 defects found, 2 are blocking

---

## 1. RLS on `tenant_configs` Table

**File:** `packages/backend/prisma/migrations/20240320_tenant_config/migration.sql`

**Status: FAIL (Blocking)**

`ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` are present. However, the migration creates only **one** combined policy (`tenant_isolation`) using a bare `USING` clause. The project rules require **4 separate policies** — one each for SELECT, INSERT, UPDATE, and DELETE. A single policy with only a `USING` clause covers SELECT and UPDATE reads but does **not** provide a `WITH CHECK` expression for INSERT or UPDATE writes.

**Required pattern (from project rules):**
```sql
CREATE POLICY tenant_select ON "tenant_configs" FOR SELECT
  USING ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_insert ON "tenant_configs" FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_update ON "tenant_configs" FOR UPDATE
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_delete ON "tenant_configs" FOR DELETE
  USING ("tenantId" = current_setting('app.current_tenant_id', true));
```

**Impact:** A misconfigured RLS app user could potentially INSERT or UPDATE rows belonging to another tenant if the current_setting is absent but the single USING policy still evaluates permissively. This is a data-isolation defect.

---

## 2. Config Service Uses Global `prisma` as Default

**File:** `packages/backend/src/modules/config/config.service.ts`, lines 36–37, 55–57, 97–98, 135–138

**Status: FAIL (Blocking)**

All four public methods (`getAllConfigs`, `getConfig`, `updateConfig`, `initializeDefaults`) accept a `db` parameter but default it to the globally-imported `prisma` singleton:

```typescript
async getAllConfigs(
  tenantId: string,
  db: DbClient = prisma,   // <-- falls back to global
): Promise<...>
```

The project rule states: **every route that queries tenant-scoped tables must use `req.db`** (the per-request RLS-scoped connection). When `db` defaults to the global singleton, any caller that omits the argument (e.g., a future service-to-service call, a test helper, or a background job that forgets to pass `req.db`) will execute queries without the RLS session variable set, bypassing tenant isolation entirely.

The controller correctly passes `req.db` in every handler — that part is sound. The risk is that the default creates a silent footgun. The default should be removed so that the compiler forces every caller to supply a scoped client:

```typescript
async getAllConfigs(tenantId: string, db: DbClient): Promise<...>
```

**Note:** `getAllConfigs` also does not check Redis cache before running a full `findMany`. For a frequently-polled endpoint this is a performance gap (see item 7 below).

---

## 3. Route Middleware Chain

**File:** `packages/backend/src/index.ts` (line 91), `packages/backend/src/modules/config/config.routes.ts`

**Status: PASS**

```typescript
app.use(`${apiBase}/config`, ...tenantMiddleware, configRouter);
// tenantMiddleware = [authenticate, resolveTenant, setRLSContext]
```

The full `authenticate → resolveTenant → setRLSContext` chain is applied at the app level before `configRouter` is mounted. The router's own comment at line 8–9 acknowledges this. No per-route duplication is needed and none is present. Correct.

---

## 4. PUT /config/:category Role Guard

**File:** `packages/backend/src/modules/config/config.routes.ts`, line 33–38

**Status: PASS**

```typescript
router.put(
  '/:category',
  requireRoles(UserRole.SCHOOL_ADMIN),
  ...
);
```

`SCHOOL_ADMIN` guard is present on the PUT route. `POST /initialize` also correctly requires `SCHOOL_ADMIN`. GET routes are open to all authenticated roles. Correct.

---

## 5. Redis Cache Strategy

**File:** `packages/backend/src/modules/config/config.service.ts`

**Status: PARTIAL PASS**

`getConfig` (single category): checks Redis first (`redis.get`), populates on miss, invalidates on `updateConfig`. Cache key format is `config:{tenantId}:{category}`. TTL is 300 seconds. This path is correct.

`getAllConfigs` (all categories): does **not** check Redis. It issues a `findMany` on every call. This endpoint is called by the frontend hook on every page load (when stale). Consider either:
- Checking all 8 per-category keys and falling back to DB only for misses, or
- Adding a separate all-categories cache key `config:{tenantId}:ALL` that is invalidated alongside the per-category key on any PUT.

`initializeDefaults`: correctly calls `redis.del` for each category after upserting. Correct.

---

## 6. Seed: for...of, not Promise.all

**File:** `packages/backend/prisma/seed.ts`, lines 1155–1187

**Status: PASS**

Both tenant config seed blocks use `for...of` loops with sequential `await prisma.tenantConfig.upsert(...)` calls. No `Promise.all` is used anywhere in the Phase 5B seeding section. `setTenantContext` is correctly called before each tenant's block (`addis` at line 1139, `hawassa` at line 1171). Correct.

---

## 7. Frontend Hook: `enabled` and `staleTime`

**File:** `packages/frontend/src/hooks/useTenantConfig.ts`

**Status: PASS**

```typescript
const STALE_TIME = 300_000; // 5 minutes
...
staleTime: STALE_TIME,
enabled: isAuthenticated,
```

`staleTime` matches the backend cache TTL (both 300 seconds / 5 minutes) — this is good alignment. `enabled: isAuthenticated` prevents the query from firing before a JWT is available. Correct.

---

## 8. TypeScript Interface Alignment: Frontend vs. Backend vs. Defaults

**Files:**
- `packages/backend/src/modules/config/config.types.ts` (backend types)
- `packages/frontend/src/types/config.ts` (frontend types)
- `packages/backend/src/modules/config/defaults/ethiopia.ts` (runtime defaults)

**Status: FAIL (Non-blocking, but causes runtime type errors)**

Two type mismatches found:

### 8a. `attendanceMode` / `mode` enum values

| Location | Value |
|---|---|
| Backend `config.types.ts` (OperationsConfig) | `'DAILY' \| 'PERIOD'` |
| Backend `config.validator.ts` (operationsConfigSchema) | `z.enum(['DAILY', 'PERIOD'])` |
| Backend `ethiopia.ts` (operations.attendanceMode) | `'DAILY'` — matches |
| Frontend `config.ts` (OperationsConfig.attendanceMode) | `'DAILY' \| 'PER_PERIOD' \| 'BOTH'` |
| Frontend `config.ts` (AttendanceConfig.mode) | `'DAILY' \| 'PER_PERIOD' \| 'BOTH'` |

The frontend declares `'PER_PERIOD'` and `'BOTH'` as valid modes, but the backend Zod schema only accepts `'DAILY'` and `'PERIOD'`. The backend and frontend are not aligned. Any frontend code that passes `'PER_PERIOD'` will receive a 400 validation error. The backend value `'PERIOD'` is also not present in the frontend union, meaning a value stored by the backend cannot be typed correctly on the frontend.

**Fix:** Align both to the same enum. Either `'DAILY' | 'PERIOD'` (following backend) or expand the backend schema — but they must match.

### 8b. `GeneralConfig.calendarType` enum

| Location | Values |
|---|---|
| Backend `config.types.ts` | `'ETHIOPIAN' \| 'GREGORIAN'` |
| Backend `config.validator.ts` | `z.enum(['ETHIOPIAN', 'GREGORIAN'])` |
| Frontend `config.ts` | `'ETHIOPIAN' \| 'GREGORIAN' \| 'HIJRI' \| 'CUSTOM'` |

Frontend declares `'HIJRI'` and `'CUSTOM'` which the backend will reject with a 400 error. Until the backend schema is extended, these values cannot be stored.

### 8c. `SiblingDiscountConfig` type

| Location | Shape |
|---|---|
| Backend `config.types.ts` | `{ [position: string]: number }` (index signature) |
| Frontend `config.ts` | `{ '2nd': number; '3rd': number; '4th': number }` (specific keys) |

These are structurally compatible at runtime but the frontend type is more restrictive. Not a defect, but worth aligning for consistency.

---

## 9. `getAllConfigs` Returns Wrong Shape vs. `TenantConfigEntry[]`

**Files:** `packages/backend/src/modules/config/config.service.ts`, `packages/frontend/src/services/config.service.ts`

**Status: FAIL (Non-blocking, but causes frontend transform failure)**

`configService.getAllConfigs` returns `Record<string, AnyConfigValue>` (a plain object keyed by category). However, `configApi.getAll` in the frontend service expects the API to return `TenantConfigEntry[]` (an array of objects each having `id`, `tenantId`, `category`, `config`, `updatedAt`, `updatedBy`).

The controller at `getAll` passes `configService.getAllConfigs(...)` output directly to `res.json({ success: true, data })`. The hook then tries to iterate `entries` with `for (const entry of entries)` accessing `entry.category` and `entry.config`.

Because the backend returns an object (`{ grading: {...}, fees: {...}, ... }`), but the frontend iterates it as an array of `TenantConfigEntry`, the `for...of` loop receives `undefined` for all entries in practice — the transform silently produces an empty `configs` map.

**Fix options:**
- Change `getAllConfigs` to return `TenantConfigEntry[]` (array form matching the frontend expectation), or
- Change `configApi.getAll` to expect `Record<string, unknown>` and update the hook accordingly.

---

## Summary Table

| # | Check | Status | Severity |
|---|---|---|---|
| 1 | RLS: ENABLE + FORCE + 4 policies | FAIL — only 1 combined policy, no WITH CHECK | Blocking |
| 2 | Service uses req.db (not global prisma) | FAIL — global prisma is the default fallback | Blocking |
| 3 | Route middleware chain | PASS | — |
| 4 | PUT role guard (SCHOOL_ADMIN) | PASS | — |
| 5 | Redis: GET checks cache, PUT invalidates | PARTIAL — getAllConfigs bypasses cache | Minor |
| 6 | Seed uses for...of | PASS | — |
| 7 | Hook: enabled when authenticated, staleTime correct | PASS | — |
| 8 | TypeScript interfaces match defaults | FAIL — attendanceMode and calendarType mismatches | Non-blocking |
| 9 | getAllConfigs shape vs. frontend expectation | FAIL — object vs. array mismatch breaks hook transform | Non-blocking |

---

## Required Actions Before Merge

1. **[BLOCKING]** Replace single `tenant_isolation` policy in migration with 4 separate FOR SELECT / FOR INSERT / FOR UPDATE / FOR DELETE policies, each with proper USING and/or WITH CHECK.
2. **[BLOCKING]** Remove the `db: DbClient = prisma` default from all four service methods; force callers to supply an explicit RLS-scoped client.
3. **[NON-BLOCKING]** Align `attendanceMode`/`mode` enum values between backend Zod schema and frontend types.
4. **[NON-BLOCKING]** Align `calendarType` enum — either remove `HIJRI`/`CUSTOM` from frontend or add them to backend schema.
5. **[NON-BLOCKING]** Fix `getAllConfigs` return shape: either return `TenantConfigEntry[]` from the service, or update the frontend service/hook to consume an object map.
6. **[MINOR]** Add Redis cache check to `getAllConfigs` path to avoid repeated `findMany` on every page load.
