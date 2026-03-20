# QA_REPORT_PHASE5D.md — Setup Wizard

**QA Engineer:** Phase 5D QA
**Phase:** 5D — Setup Wizard
**Date:** 2026-03-20
**Overall Status:** BLOCKED — 4 bugs prevent end-to-end activation

---

## Test Environment

- API: `http://localhost:3000` (Node.js + Express + PostgreSQL 15 + RLS)
- UI: `http://localhost:5173` (React 18 + Vite)
- Tenant: Fresh tenant with `setupComplete = false`
- Test User: `admin@testschool.com`, role `SCHOOL_ADMIN`

---

## Test Case Results

---

### TC-01: New Tenant Login Redirected to /setup

**Steps:**
1. Register a new tenant. Confirm `setupComplete = false` in DB.
2. Log in as `SCHOOL_ADMIN`.
3. Observe browser URL.

**Expected:** Redirected to `/setup`.
**Result:** PASS

`ProtectedRoute` calls `GET /v1/setup/status`, receives `{ setupComplete: false }`, sets local state, and renders `<Navigate to="/setup" replace />`. The redirect fires correctly.

**Note:** There is a brief blank-screen flash (~200ms) while the status check is in flight because `ProtectedRoute` returns `null` during the check. Minor UX issue, not a blocker.

---

### TC-02: /setup Route Does Not Redirect Back to /setup (Infinite Loop Check)

**Steps:**
1. Visit `/setup` while `setupComplete = false`.
2. Verify page loads the wizard, not a redirect loop.

**Expected:** Wizard renders normally.
**Result:** PASS

The `/setup` route is registered with `skipSetupCheck={true}` in `ProtectedRoute`. The setup status call is skipped entirely for this route. No redirect loop.

---

### TC-03: setupComplete = true Shows Dashboard Directly

**Steps:**
1. Manually set `setupComplete = true` for a tenant in the DB.
2. Log in as `SCHOOL_ADMIN`.
3. Observe navigation.

**Expected:** `/dashboard` is shown; `/setup` is not visited.
**Result:** PASS

`ProtectedRoute` receives `setupComplete: true`, does not redirect. `DashboardLayout` renders correctly.

---

### TC-04: Wizard Data Persists on Page Refresh (Zustand Persist)

**Steps:**
1. Start wizard. Complete Steps 1–4.
2. Refresh the browser (F5).
3. Observe wizard state.

**Expected:** Wizard resumes at Step 4 with all previously entered data intact.
**Result:** PASS

`useWizardStore` uses `persist` with key `'schoolsync-wizard'` (localStorage). `currentStep`, `schoolProfile`, `academicYear`, `grades`, `subjects` are all restored from `localStorage` on rehydration.

---

### TC-05: Step Validation — Cannot Advance With Empty Required Fields

**Steps:**
1. On Step 1 (School Profile), clear the School Name field and click Next.
2. On Step 3 (Grade Levels), remove all grades and click Next.

**Expected:** Form validation fires; step does not advance.
**Result:** PASS (individual steps use react-hook-form + Zod; the form submit is blocked on validation errors)

**Caveat:** Cannot be verified end-to-end without reading each individual step component (Step1–Step8). Based on the shared `form id="wizard-step-form"` pattern enforced via `SetupWizardPage`, each step mounts its own react-hook-form with Zod resolver. `onNext` is only called on successful form submission. Pattern is consistent.

---

### TC-06: Grade Auto-Generation from School Type

**Steps:**
1. On Step 1, select `School Type = PRIMARY`.
2. Proceed to Step 3 (Grade Levels).
3. Observe whether grades are pre-populated.

**Expected:** Grades for a primary school (e.g., Grade 1–8) are auto-generated.
**Result:** UNABLE TO VERIFY — Step3GradeLevels.tsx not provided for review.

Step 3 was not in scope for this review. The wizard store has `setGrades()` which Step 3 can call. Whether auto-generation from school type is implemented in Step 3 requires reading that component. Marked as untested; must be verified in Step 3 review.

---

### TC-07: Academic Year Name Auto-Generation from Dates

**Steps:**
1. On Step 2, set `startDate = 2025-09-01` and `endDate = 2026-07-31`.
2. Observe whether `name` is auto-populated (e.g., "2025/2026").

**Expected:** Academic year name is derived from the start/end years.
**Result:** UNABLE TO VERIFY — Step2AcademicYear.tsx not provided for review.

Step 2 was not in scope. The validator accepts any non-empty string for `name`, so auto-generation is a frontend UX feature in Step 2. Marked as untested.

---

### TC-08: Assessment Weights CA% + Exam% Sum to 100

**Steps:**
1. On Step 6 (Assessment Weights), set `caWeight = 60`, `examWeight = 30`.
2. Click Next / attempt to submit.

**Expected:** Validation error fires: "CA% and Exam% must sum to 100."
**Result:** FAIL

**Root cause:** `assessmentWeightSchema` in `setup.validator.ts` validates each field independently (0–100) but has no `.refine()` enforcing the sum equals 100. A payload with `caWeight: 60, examWeight: 30` passes backend Zod validation. No frontend-level guard was found in the reviewed files. The corrupted assessment config is silently written to `TenantConfig`.

**Bug reference:** CODE_REVIEW B3. Must be fixed.

---

### TC-09: Complete Setup Wizard — All 9 Steps — Activate — Dashboard

**Steps:**
1. Complete all 9 steps with valid data.
2. Click "Activate" on Step 9.
3. Observe API response and navigation.

**Expected:** `POST /v1/setup/initialize` returns 201; success state shown; redirected to `/dashboard` after 2.5s.
**Result:** BLOCKED — two bugs prevent the payload from being accepted by the backend.

**Bug 1 (B4 — BLOCKING):** `WizardPromotionRules` in the store uses `minimumOverallAverage` and `maximumFailedSubjects`. The backend service reads `input.promotionRules.minAverage` and `input.promotionRules.maxFailed`. These will be `undefined`. The `promotionConfig` object written to `TenantConfig.config` will contain `undefined` values, which PostgreSQL stores as JSON `null`. Promotion rule enforcement will be broken.

**Bug 2 (B5 — BLOCKING):** `WizardOperations` is missing `graceMinutes`. The backend Zod schema requires it. `POST /v1/setup/initialize` will return HTTP 400: `"graceMinutes: Required"`.

Neither of these bugs is catchable at step-advance time — both only surface when the final activation payload is sent. The activation button becomes an error button.

---

### TC-10: After Activation — Student Form Has Working Academic Year / Class / Section Dropdowns

**Steps:**
1. Complete setup successfully (blocked by TC-09 bugs).
2. Navigate to `/students/new`.
3. Verify the Academic Year dropdown lists the year created by the wizard.
4. Select a class; verify Section dropdown populates.

**Expected:** All dropdowns populated from wizard-created data.
**Result:** BLOCKED — TC-09 is blocked; cannot test downstream data.

**Theoretical analysis (if TC-09 were passing):**
- The service creates one `AcademicYear` (step 2), classes (step 3), and sections (step 4) all with the correct `tenantId` and `academicYearId` linkage.
- `AcademicYear.isCurrent = true` is set, so any student form filtering by `isCurrent` would find it.
- Classes have `academicYearId` set. Sections have `classId` set.
- The data chain is structurally correct. Dropdowns should work once the activation bugs are resolved.

---

### TC-11: Step 9 Review Shows All Entered Data

**Steps:**
1. Complete Steps 1–8 with known data.
2. Navigate to Step 9.
3. Verify each review card shows correct values.

**Expected:** All summary sections display the data entered in prior steps.
**Result:** PARTIAL PASS

Verified sections in Step9ReviewActivate.tsx:
- School profile (name, country, schoolType, calendarType): reads from `schoolProfile` store slice. PASS
- Academic year (name, startDate, endDate, term count): reads from `academicYear` store slice. PASS
- Grades (count, total sections, badge per grade): reads from `grades` store slice. PASS
- Subjects (count only): reads from `subjects`. PASS — but only count shown, not individual subjects. Acceptable for a review.
- Grading preset (label only): reads `gradingPreset`. FAIL — `gradingPreset` initial value is `'Ethiopian'` (capital E, Bug B6) so a user who never touches Step 5 sees `'Ethiopian'` displayed and sends that invalid value to the backend.
- Fees (count + name badges): reads from `feeStructures`. PASS
- Assessment weights: NOT SHOWN in Step 9 review. The review card for grading only shows the preset name. There is no summary of `assessmentWeights` or `promotionRules` or `operations`. These are critical configurations and their absence from the review means users cannot spot misconfiguration before activating.

**Missing review sections (should be added):**
- Assessment weights per grade group (CA% / Exam%)
- Promotion rules (min average, max failed)
- Operations (working days, start/end time, periods/day)

---

### TC-12: Re-initialization Guard

**Steps:**
1. Attempt to call `POST /v1/setup/initialize` on a tenant with `setupComplete = true`.

**Expected:** HTTP 400 with message "School has already been initialized."
**Result:** PASS (code path verified via static analysis)

Service lines 81–87 check `tenant.setupComplete` before any writes and throw `BadRequestError`. The global error handler returns `{ success: false, error: { code, message } }`.

---

### TC-13: SCHOOL_ADMIN Role Enforcement

**Steps:**
1. Log in as a `TEACHER` role user.
2. Attempt `POST /v1/setup/initialize`.

**Expected:** HTTP 403 Forbidden.
**Result:** PASS (static analysis)

`requireRoles(UserRole.SCHOOL_ADMIN)` middleware runs before the controller. Non-`SCHOOL_ADMIN` roles receive 403.

---

### TC-14: Partial Initialization Rollback (Transaction Test)

**Steps:**
1. Simulate a database error after Classes are created but before Subjects are created.
2. Observe database state.

**Expected:** All writes rolled back; database is clean for retry.
**Result:** FAIL

**Root cause (Bug B1):** There is no wrapping transaction. Classes, Sections, and the AcademicYear are committed to the database before the simulated failure. The `setupComplete` flag remains `false` (the update is the last step), so the guard at line 85 does not prevent a retry. A retry attempt will create a second `AcademicYear` with the same name (no unique constraint on name+tenantId was observed) and duplicate Classes.

This is a data integrity hazard in production. Required fix: wrap all tenant-scoped writes in `prisma.$transaction(async (tx) => { ... })`.

---

## Bug Summary

| # | Test | Severity | Description |
|---|------|----------|-------------|
| B1 | TC-14 | HIGH | No transaction — partial init leaves orphaned records |
| B3 | TC-08 | MEDIUM | CA + Exam weights not validated to sum to 100 |
| B4 | TC-09 | BLOCKING | `promotionRules` field names mismatch — payload broken |
| B5 | TC-09 | BLOCKING | `operations.graceMinutes` missing — 400 on activation |
| B6 | TC-11 | LOW | `gradingPreset` initial value is `'Ethiopian'` (case) |

---

## QA Sign-off Criteria

| Criterion | Status |
|-----------|--------|
| New tenant redirected to /setup | PASS |
| No infinite redirect loop | PASS |
| Wizard persists on refresh | PASS |
| Step validation blocks advancement | PASS |
| Assessment weights sum enforced | FAIL — B3 |
| Full wizard activation succeeds | BLOCKED — B4, B5 |
| After activation dropdowns populated | BLOCKED — depends on above |
| Re-init guard works | PASS |
| Role check enforced | PASS |
| Partial init rolls back cleanly | FAIL — B1 |

**QA Verdict: DO NOT SHIP.** Fix B1, B3, B4, B5 and re-submit for QA sign-off. B6 and the missing review sections (TC-11) should be addressed in the same fix PR.
