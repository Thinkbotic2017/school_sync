# CODE_REVIEW_PHASE5C.md — Settings Pages

**Reviewer:** Senior Full Stack Reviewer
**Phase:** 5C — Settings Pages
**Date:** 2026-03-20
**Files Reviewed:**
- `packages/frontend/src/pages/settings/SettingsPage.tsx`
- `packages/frontend/src/pages/settings/components/SchoolProfileSettings.tsx`
- `packages/frontend/src/pages/settings/components/AcademicSettings.tsx`
- `packages/frontend/src/pages/settings/components/OperationsSettings.tsx`
- `packages/frontend/src/pages/settings/components/FeeSettings.tsx`
- `packages/frontend/src/pages/settings/components/AttendanceSettings.tsx`
- `packages/frontend/src/pages/settings/components/PromotionSettings.tsx`
- `packages/frontend/src/pages/settings/components/ReportCardSettings.tsx`

---

## Overall Assessment: CONDITIONAL PASS

The implementation is structurally sound. All 7 tabs are present, the form pattern (react-hook-form + Zod + shadcn Form) is consistently applied, and every component correctly initializes from `useTenantConfig` via `useEffect` + `form.reset`. However there are three bugs that must be fixed before merge and several lower-priority items.

---

## Checklist Results

| Criteria | Status | Notes |
|----------|--------|-------|
| All 7 tabs present in SettingsPage | PASS | profile, academic, operations, fees, attendance, promotion, report_card |
| react-hook-form + Zod + shadcn Form | PASS | All 7 components comply |
| useEffect + form.reset from useTenantConfig | PASS | All components follow the pattern |
| PUT /v1/config/:category + refetch | PASS | All mutations call `configApi.updateCategory` then `refetch()` |
| All strings through `t()` | PARTIAL — see BUG-01 | |
| No raw HTML inputs/selects/buttons | FAIL — see BUG-02 | |
| TypeScript types correct, no `any` | PARTIAL — see BUG-03 | |
| Skeleton loaders while loading | PASS | Every component has a dedicated skeleton |

---

## Bugs (Must Fix Before Merge)

### BUG-01 — Hardcoded strings not passed through `t()`

**Severity:** Medium
**Files:** `AcademicSettings.tsx`, `OperationsSettings.tsx`, `AttendanceSettings.tsx`

The preset labels in the grading scale selector (`'Ethiopian'`, `'IGCSE'`, `'IB'`, `'American'`, `'Custom'`) at `AcademicSettings.tsx:195` are rendered directly without `t()`. The same applies to the `countryPresets` keys rendered as `SelectItem` children in `SchoolProfileSettings.tsx:167` — country names are rendered as raw strings, not through translation keys.

Additionally, in `OperationsSettings.tsx`, the `WEEK_DAYS` array values (`'Monday'` etc.) at line 30 are used as day-toggle labels only via `t(\`settings.operations.day_${day.toLowerCase()}\`)`  — this is acceptable — but the hardcoded English string `'Lunch'` used as the placeholder at line 270 is not wrapped in `t()`.

In `GroupEditor` (`AcademicSettings.tsx:505`), the placeholder `"Grade 1, Grade 2, ..."` is hardcoded English.

**Fix required:** Pass all user-visible string literals through `t()` with appropriate keys added to both `en.json` and `am.json`.

---

### BUG-02 — Raw HTML `<input type="radio">` used instead of shadcn component

**Severity:** High (violates CLAUDE.md anti-slop rule: "shadcn/ui is MANDATORY — never raw HTML `<input>`")
**Files:** `OperationsSettings.tsx` lines 241–249, `AttendanceSettings.tsx` lines 122–130

Both files render radio group choices using a native `<input type="radio" ... />` element with an `accent-primary` class rather than using a shadcn `RadioGroup` / `RadioGroupItem`. This violates the mandatory shadcn-only rule and will produce inconsistent styling in dark mode.

```tsx
// Current (violates rules):
<input
  type="radio"
  value={mode}
  checked={field.value === mode}
  onChange={() => field.onChange(mode)}
  className="accent-primary"
/>

// Required: shadcn RadioGroup + RadioGroupItem
```

**Fix required:** Replace all `<input type="radio">` instances with `<RadioGroup>` / `<RadioGroupItem>` from `@/components/ui/radio-group`.

---

### BUG-03 — TypeScript type cast in ReportCardSettings toggle loop

**Severity:** Low-Medium
**File:** `ReportCardSettings.tsx` line 171

The `toggleFields` loop casts the `name` to `'showRank'` as a workaround for the union type:

```tsx
name={name as 'showRank'}
```

This suppresses proper TypeScript inference. The correct approach is to type `toggleFields` as `Array<{ name: Extract<keyof FormValues, 'showRank' | 'showAttendance' | 'showConduct' | 'showTeacherRemarks' | 'showPrincipalRemarks' | 'showPhoto'>; labelKey: string }>` so the cast is not necessary.

---

## Code Quality Issues (Non-Blocking)

### ISSUE-01 — CA weight slider uses `<Input type="range">` instead of shadcn Slider

**File:** `AcademicSettings.tsx` lines 519–522
**Severity:** Low

`<Input type="range" ... />` is used for the CA weight slider. The `Input` component wraps a text input and styling will be wrong for range. The correct component is `<Slider>` from `@/components/ui/slider`. This is functionally correct but cosmetically inconsistent.

---

### ISSUE-02 — `showCustomCurrency` state is a derived value, not truly stateful

**File:** `FeeSettings.tsx` line 84
**Severity:** Low

`showCustomCurrency` is managed as separate `useState` but is entirely derivable from `form.watch('currency') === 'Custom'`. This creates a secondary state that can drift from the form value (e.g., if `form.reset` is called with `currency: 'Custom'` the `useState` is updated inside the `useEffect` only, which runs asynchronously). Using `const showCustomCurrency = form.watch('currency') === 'Custom'` would be simpler and eliminate the potential drift.

---

### ISSUE-03 — `customCurrency` has no minimum length validation when `currency === 'Custom'`

**File:** `FeeSettings.tsx` lines 49, 125–126
**Severity:** Low

The `customCurrency` field is `z.string().optional()`. When `currency === 'Custom'` the mutation resolves the currency as `values.customCurrency ?? 'USD'`, meaning an empty custom currency silently falls back to `'USD'` without user awareness. Use `z.string().superRefine()` or a `.refine()` on the root schema to require `customCurrency` when `currency === 'Custom'`.

---

### ISSUE-04 — Grading scale does not validate that `min <= max` per row

**File:** `AcademicSettings.tsx` lines 84–90
**Severity:** Low

`gradeRowSchema` validates `min` and `max` independently but does not verify `min <= max`. A teacher could save a row where `min: 90, max: 80` without any error. Add `.refine((d) => d.min <= d.max, { message: 'Min must be <= Max', path: ['max'] })` to `gradeRowSchema`.

---

### ISSUE-05 — `FormMessage` missing from some inline table cells in AcademicSettings

**File:** `AcademicSettings.tsx` lines 222–229
**Severity:** Low

The `FormItem` elements inside the grading scale table cells omit `<FormMessage />`. Validation errors on individual grade row fields are silently swallowed. Add `<FormMessage />` to each cell's `FormItem`.

---

### ISSUE-06 — `ReportCardSettings` missing `FormMessage` on language selects

**File:** `ReportCardSettings.tsx` lines 191–208
**Severity:** Low

The `primaryLanguage` and `secondaryLanguage` `FormItem` elements do not include `<FormMessage />`. Add it for consistency.

---

### ISSUE-07 — `OperationsSettings` working day checkboxes not wrapped in FormField

**File:** `OperationsSettings.tsx` lines 140–156
**Severity:** Low

The working-day checkboxes are rendered outside `<FormField>` and error display is handled with a manual `form.formState.errors.workingDays.message` check. This breaks the shadcn Form accessibility pattern (no `aria-describedby` linkage). Wrapping in a `<FormField name="workingDays" ...>` with a `<FormMessage />` would standardise the error handling.

---

### ISSUE-08 — `AssessmentWeightsForm` calls `useTenantConfig` independently from parent

**File:** `AcademicSettings.tsx` lines 135, 356
**Severity:** Low

Both `GradingScaleForm` and `AssessmentWeightsForm` each call `useTenantConfig()` independently, resulting in two React Query subscriptions to the same endpoint. Consider lifting `configs` and `isLoading` to the `AcademicSettings` parent component and passing them as props to avoid redundant fetches.

---

## What Was Done Well

- The `handleCountryChange` preset pattern in `SchoolProfileSettings` is clean — one handler updates three dependent fields atomically using `form.setValue`.
- The `examWeight` derived display in `GroupEditor` (`100 - caWeight`) is computed reactively from `form.watch` without needing a separate state variable — this is correct.
- The `PromotionSettings` conditional render of `reExamMaxAttempts` gated on `reExamAllowed` watch value is a textbook example of the correct pattern.
- All mutation payloads correctly transform comma-separated strings back to arrays before sending (see `PromotionSettings`, `AssessmentWeightsForm`).
- The `FeeSettings` useEffect correctly detects a custom currency on load by checking whether the stored value is absent from the `CURRENCIES` list — this handles the case where the API returns a custom code that was previously saved.
- Skeleton shapes match the form layout in all components (labeled field pairs for most; switch rows for `ReportCardSettings`).
- Dark mode is fully handled through shadcn CSS variable tokens — no hardcoded color values were found.

---

## Summary of Required Fixes

| ID | Severity | File | Action |
|----|----------|------|--------|
| BUG-01 | Medium | AcademicSettings, SchoolProfileSettings, OperationsSettings | Pass all visible strings through `t()` |
| BUG-02 | **High** | OperationsSettings, AttendanceSettings | Replace `<input type="radio">` with shadcn `RadioGroup` / `RadioGroupItem` |
| BUG-03 | Low-Medium | ReportCardSettings | Fix TypeScript cast with proper union type |
| ISSUE-01 | Low | AcademicSettings | Replace `<Input type="range">` with shadcn `<Slider>` |
| ISSUE-02 | Low | FeeSettings | Derive `showCustomCurrency` from `form.watch` instead of `useState` |
| ISSUE-03 | Low | FeeSettings | Add conditional Zod validation for `customCurrency` when currency is Custom |
| ISSUE-04 | Low | AcademicSettings | Add `min <= max` refine to `gradeRowSchema` |
| ISSUE-05 | Low | AcademicSettings | Add `<FormMessage />` to table cell `FormItem` elements |
| ISSUE-06 | Low | ReportCardSettings | Add `<FormMessage />` to language `FormItem` elements |
| ISSUE-07 | Low | OperationsSettings | Wrap working-day checkboxes in `<FormField>` |
| ISSUE-08 | Low | AcademicSettings | Lift `useTenantConfig` to parent to avoid duplicate subscriptions |

**BUG-02 is the only blocker.** BUG-01 and BUG-03 must also be fixed before merge per project rules. All ISSUE items should be addressed in the same sprint.
