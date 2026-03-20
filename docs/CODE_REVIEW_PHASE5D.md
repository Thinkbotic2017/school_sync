# CODE_REVIEW_PHASE5D.md — Setup Wizard

**Reviewer:** Senior Full Stack Reviewer
**Phase:** 5D — Setup Wizard
**Date:** 2026-03-20
**Verdict:** APPROVED WITH REQUIRED FIXES (3 bugs, 2 warnings)

---

## 1. Backend: setup.service.ts

### 1.1 Promise.all Compliance — PASS

Zero uses of `Promise.all` in the service. All 7 creation loops (`configEntries`, `grades`, `sections`, `subjects`, `classSubjects`, `feeStructures`) use sequential `for...of` with `await`. The `for...of` over `configEntries` (line 173) and each subsequent collection is correctly serialized. No violations.

### 1.2 RLS Context — PASS

The service signature accepts `db: DbClient` (line 78) and every tenant-scoped write (TenantConfig, AcademicYear, Class, Section, Subject, ClassSubject, FeeStructure) uses this injected `db` client. The controller passes `req.db!` (controller line 18), which is the connection with RLS context already set by the `setRLSContext` middleware in `index.ts` (line 93).

### 1.3 Global Prisma for Tenant.setupComplete — PASS (intentional, correctly documented)

Lines 81–86 read from `prisma.tenant` (global) to check if setup is already complete, and line 319 updates `prisma.tenant.setupComplete = true` (global). The Tenant table is a platform-level table with no RLS. The comment on line 316–318 explicitly documents this is intentional and safe. This is the correct behavior.

### 1.4 No Transaction Wrapping — BUG (SEVERITY: HIGH)

**Issue:** The 7-step initialization sequence (TenantConfig upserts, AcademicYear, Classes, Sections, Subjects, ClassSubjects, FeeStructures, Tenant update) is NOT wrapped in a `prisma.$transaction([...])` or interactive transaction. If the process fails at Step 5 (Subjects) after Classes and Sections have been committed, the database is left in a partially initialized state: classes exist but subjects do not. The guard at line 85 (`if (tenant.setupComplete)`) only checks `setupComplete`, which has not yet been set to `true`, so a retry attempt would create duplicate Classes and AcademicYears.

**Required fix:** Wrap all `db.*` writes (steps 1–7) in an interactive transaction (`prisma.$transaction(async (tx) => { ... })`). Keep the `prisma.tenant.update` (step 8) outside the transaction since it operates on a different (non-RLS) connection. The guard check must also move inside the transaction or use `prisma.$transaction` with serializable isolation to prevent a race.

### 1.5 Currency Hardcoded Logic — WARNING

Lines 127 and 135 hardcode `'USD'` as the fallback for non-ET countries: `input.schoolProfile.country === 'ET' ? 'ETB' : 'USD'`. This violates the "Configuration Over Code" principle. A school in Kenya, Uganda, or Nigeria would be assigned USD. The currency should either come from the wizard input directly or from a country-to-currency lookup table. Not a blocking bug for initial launch but must be addressed before the product is used outside Ethiopia.

### 1.6 HIJRI and CUSTOM Calendar Types — WARNING

`setup.types.ts` declares `calendarType` as accepting `'GREGORIAN' | 'ETHIOPIAN' | 'HIJRI' | 'CUSTOM'`, and the validator allows those values. However, `setup.service.ts` line 188–191 only maps `ETHIOPIAN` to `CalendarType.ETHIOPIAN` and falls back everything else to `CalendarType.GREGORIAN`. A school choosing `HIJRI` or `CUSTOM` silently gets Gregorian. No error is thrown. Add explicit handling or a validator refinement rejecting unsupported values until they are implemented.

### 1.7 Terms Field Accepted But Never Persisted — BUG (SEVERITY: MEDIUM)

`academicYearSchema` (validator line 26) and `SetupWizardInput` (types line 14) both include a `terms` array. The `AcademicYear.create` call (service lines 193–202) does not persist terms. If a `Term` model exists in the schema, terms are silently dropped. If the `Term` model does not exist yet, the validator should not collect that data. Either persist terms or remove the field from the schema and types to avoid user confusion.

### 1.8 `periodDurationMinutes` Hardcoded — MINOR

`operationsConfig.periodDurationMinutes` is hardcoded to `45` (line 121). The wizard's `operations` schema (`setup.validator.ts`) does not collect this from the user. Low severity but should be surfaced as a wizard field given the "Configuration Over Code" principle.

### 1.9 `rankingEnabledFromGrade` Derivation — MINOR

Line 111: `input.grades[Math.floor(input.grades.length / 2)]?.name ?? ''`. The midpoint heuristic for when to enable ranking is not documented, not configurable, and produces an empty string if `grades` is empty (which the validator prevents, but still). This should be an explicit wizard field in the Promotion Rules step.

---

## 2. Backend: setup.routes.ts

### 2.1 Auth Middleware Chain — PASS

`setup.routes.ts` correctly relies on the global middleware chain mounted in `index.ts` (line 93): `authenticate → resolveTenant → setRLSContext`. The comment on route line 8 documents this dependency. Correct.

### 2.2 SCHOOL_ADMIN Role Check — PASS

`POST /initialize` applies `requireRoles(UserRole.SCHOOL_ADMIN)` (line 21) before the validator and controller. `GET /status` is correctly left open to any authenticated tenant user. Correct.

### 2.3 Validate Middleware Ordering — PASS

`requireRoles → validate(setupWizardSchema) → controller.initialize` is the correct order: role check before expensive Zod validation.

---

## 3. Backend: setup.validator.ts

### 3.1 CA + Exam Weight Sum Not Validated — BUG (SEVERITY: MEDIUM)

`assessmentWeightSchema` (lines 59–65) validates `caWeight` and `examWeight` independently (each 0–100) but does NOT enforce that `caWeight + examWeight === 100`. A payload with `caWeight: 60, examWeight: 30` passes validation. Add a `.refine()` check:

```typescript
.refine((d) => d.caWeight + d.examWeight === 100, {
  message: 'caWeight and examWeight must sum to 100',
  path: ['examWeight'],
})
```

### 3.2 Subject Type Enum Mismatch with Store — BUG (SEVERITY: LOW)

`subjectInputSchema` (line 47) accepts `['CORE', 'ELECTIVE', 'EXTRACURRICULAR']`. The wizard store's `WizardSubject.type` (wizard.store.ts line 42) is typed as `'CORE' | 'ELECTIVE'` — `EXTRACURRICULAR` is missing. The frontend can never send `EXTRACURRICULAR` even though the validator accepts it. Fix the store type to include `'EXTRACURRICULAR'`.

### 3.3 Date Validation Allows Logically Invalid Ranges — MINOR

`academicYearSchema` (lines 22–27) and `termSchema` (lines 16–20) validate date format but do not check that `endDate > startDate`. A school could submit `startDate: "2025-09-01"` and `endDate: "2024-09-01"` and pass validation.

### 3.4 `customGrading` Schema Too Permissive — MINOR

`customGrading` is `z.object({}).passthrough().optional()` (line 105). Any object is accepted with no structural guarantee. This is acceptable for the initial wizard but the `SCHOOL_OPERATIONS.md` spec should be referenced to define the expected shape and a stricter schema should be added in the next iteration.

---

## 4. Frontend: wizard.store.ts

### 4.1 Zustand Persist — PASS

`useWizardStore` wraps state with `persist` middleware (line 129) using key `'schoolsync-wizard'` (line 147). All wizard state (currentStep, schoolProfile, academicYear, grades, subjects, gradingPreset, customGrading, assessmentWeights, feeStructures, promotionRules, operations) persists to `localStorage`. A page refresh restores exactly where the user left off.

### 4.2 `gradingPreset` Initial Value Case Mismatch — BUG (SEVERITY: LOW)

`initialState.gradingPreset` is `'Ethiopian'` (line 118, capital E). The backend validator (setup.validator.ts line 104) accepts `'ethiopian'` (lowercase). The service looks up `GRADING_PRESETS['Ethiopian']` (line 93) which returns `undefined`, then falls through to `GRADING_PRESETS['ethiopian']`. This means the initial default silently falls back to the right value through the `??` operator, but it is a latent bug: the string comparison `input.gradingPreset === 'custom'` (service line 91) correctly uses lowercase, and Zod validation on the backend will reject `'Ethiopian'` with a 400 error at the enum check. Change the initial value to `'ethiopian'`.

### 4.3 `WizardPromotionRules` Field Name Mismatch — BUG (SEVERITY: MEDIUM)

`WizardPromotionRules` in the store (lines 67–73) uses:
- `minimumOverallAverage` (not `minAverage`)
- `maximumFailedSubjects` (not `maxFailed`)
- `reExamMaxAttempts` (extra field not in backend type)
- Missing `graceMinutes` in `WizardOperations` (store line 75–81) vs. backend `operationsSchema` which requires `graceMinutes`

`setup.types.ts` frontend type (line 22) re-exports `WizardPromotionRules` directly as `promotionRules`. When Step9 assembles the payload (Step9ReviewActivate.tsx line 94–104) it passes `promotionRules` from the store directly into `SetupWizardInput`. The backend service maps `input.promotionRules.minAverage` (line 106) which will be `undefined` because the store uses `minimumOverallAverage`. The promotion config will silently contain `undefined` values, corrupting the stored JSON.

**Required fix:** Align field names. Either rename the store interface fields to match the backend (`minAverage`, `maxFailed`, `reExamAllowed`) or add an explicit mapping in Step9 before building the payload.

### 4.4 `WizardOperations` Missing `graceMinutes` — BUG (SEVERITY: MEDIUM)

`WizardOperations` (store lines 75–81) contains `schoolStartTime`, `schoolEndTime`, `periodsPerDay`, `attendanceMode` — but is missing `graceMinutes`. The backend `operationsSchema` (validator line 93) requires `graceMinutes`. The assembled payload will pass `graceMinutes: undefined` which Zod will reject with a 400 validation error. Add `graceMinutes: number` to `WizardOperations`.

### 4.5 No `partialize` on Wizard Persist — MINOR

Unlike `auth.store.ts` which uses `partialize` to only persist tokens, `wizard.store.ts` persists the full state including `currentStep`. This is intentional for the wizard use case but means `reset()` must be called after activation (Step9 does call `reset()` at line 79) to avoid stale data from a previous setup affecting a new session or multi-tenant scenario. The `reset()` call is present and correctly placed before navigation.

---

## 5. Frontend: routes/index.tsx

### 5.1 Setup Status Check Placement — PASS

`ProtectedRoute` (line 38) fetches `setupApi.getStatus()` inside a `useEffect` on every navigation. The `/setup` route passes `skipSetupCheck={true}` (line 83), making it exempt from the redirect-to-`/setup` logic. There is no infinite redirect loop.

### 5.2 Setup Status API Called Per Route Change — WARNING

`useEffect` depends on `[isAuthenticated, skipSetupCheck, location.pathname]` (line 60). Every route change triggers a fresh API call to `GET /v1/setup/status`. After setup is complete, this is wasteful. Consider caching the result in the auth store or React Query after the first successful `setupComplete: true` response.

### 5.3 Silent Fail on Status Error — ACCEPTABLE WITH NOTE

On API failure (line 56–58), `setupComplete` defaults to `true`, allowing the user to proceed. This is a deliberate defensive default (commented in code) to avoid blocking users if the endpoint is temporarily unavailable. Acceptable, but should be logged in production.

### 5.4 Blank Render During Setup Check — MINOR

Line 63: `if (!setupChecked) return null` renders nothing during the status check. A skeleton or loading indicator should be shown to avoid a flash of blank content.

---

## 6. Frontend: Step9ReviewActivate.tsx

### 6.1 Payload Shape Correctness — FAIL (see Bug 4.3, 4.4)

The payload assembled at lines 94–104 passes store data directly. Due to the field name mismatches in `WizardPromotionRules` (Bug 4.3) and missing `graceMinutes` in `WizardOperations` (Bug 4.4), the payload will fail backend Zod validation or produce corrupted config data. This must be fixed before shipping.

### 6.2 Null Guard on `operations` — WARNING

`payload.operations` is typed as `WizardOperations | null` (types/setup.ts line 22). If the user somehow reaches Step 9 without completing Step 8 (Operations), `operations` will be `null`. The guard at line 89 only checks `schoolProfile`, `academicYear`, and `promotionRules` — not `operations`. The backend will receive `operations: null` and the validator will reject it with a 400. Add `|| !operations` to the guard condition.

### 6.3 Double Activation Risk — WARNING

`handleActivate` can be triggered two ways on Step 9:
1. The hidden `<form id="wizard-step-form">` `onSubmit` (line 256) — triggered by the parent wizard's `<Button type="submit" form="wizard-step-form">` when it is shown.
2. The explicit `<Button onClick={handleActivate}>` at line 268.

However, the parent `SetupWizardPage.tsx` hides the Next/Submit button on the last step (line 139: `{!isLastStep && ...}`) and only shows the Back button. The form submit path is therefore unreachable by the user. The hidden form and the `_onNext` prop (which is unused, prefixed with `_`) are dead code. This should be cleaned up to avoid confusion.

### 6.4 Confetti Uses `Math.random()` in Render — MINOR

`ConfettiOverlay` (line 17) calls `Math.random()` directly in the render body (lines 26–29). This will produce different values on each re-render, causing animation jitter if the component re-renders. The random values should be memoized with `useMemo` or computed once.

### 6.5 Error Display Quality — PASS

Line 113–114 extracts the backend error message from `err.response.data.error.message` with a fallback to `t('common.errors.server_error')`. This correctly follows the API error envelope format `{ success: false, error: { code, message } }`.

---

## 7. Frontend: services/setup.service.ts

### 7.1 Correct API Paths — PASS

`GET /setup/status` and `POST /setup/initialize` match `setup.routes.ts` exactly.

### 7.2 Response Unwrapping — PASS

Both methods unwrap `data.data` to strip the `{ success, data }` envelope before returning. Correct.

---

## Summary of Findings

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| B1 | HIGH | setup.service.ts | No transaction wrapping — partial init on failure |
| B2 | MEDIUM | setup.service.ts | Terms accepted by validator/types but never persisted |
| B3 | MEDIUM | setup.validator.ts | CA + Exam weights not validated to sum to 100 |
| B4 | MEDIUM | wizard.store.ts + Step9 | `WizardPromotionRules` field names don't match backend |
| B5 | MEDIUM | wizard.store.ts + Step9 | `WizardOperations` missing `graceMinutes` field |
| B6 | LOW | wizard.store.ts | `gradingPreset` initial value `'Ethiopian'` fails backend enum |
| B7 | LOW | wizard.store.ts | `WizardSubject.type` missing `'EXTRACURRICULAR'` |
| W1 | WARN | setup.service.ts | Currency hardcoded to USD for non-ET countries |
| W2 | WARN | setup.service.ts | HIJRI/CUSTOM calendar silently falls back to GREGORIAN |
| W3 | WARN | routes/index.tsx | Status API called on every route change after setup |
| W4 | WARN | Step9ReviewActivate.tsx | `operations: null` not guarded before payload assembly |
| W5 | WARN | Step9ReviewActivate.tsx | Double-activation path (form + button) — dead form code |

**Blocking bugs before QA sign-off:** B1, B3, B4, B5 must be fixed. B2, B6, B7 should be fixed in the same PR.
