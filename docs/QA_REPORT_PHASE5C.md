# QA_REPORT_PHASE5C.md — Settings Pages

**QA Engineer**
**Phase:** 5C — Settings Pages
**Date:** 2026-03-20
**Test Type:** Static analysis + code-path trace (no running environment)

---

## Overall Result: FAIL — 3 test cases blocked, 1 test case defective

4 of 10 test cases have identifiable defects traceable to the code. The remaining 6 pass under code-path analysis. The blocking defects are: raw HTML radio inputs (shadcn rule violation), missing required-field validation on custom currency, and a TypeScript type cast that will mask runtime errors.

---

## Test Cases

---

### TC-01: Navigate to /settings — all 7 tabs visible

**Expected:** 7 tab triggers visible: Profile, Academic, Operations, Fees, Attendance, Promotion, Report Card
**Code path:** `SettingsPage.tsx` lines 25–31

**Result: PASS**

All 7 `TabsTrigger` elements are present with correct `value` attributes (`profile`, `academic`, `operations`, `fees`, `attendance`, `promotion`, `report_card`). Labels go through `t()`. The `TabsList` uses `flex flex-wrap` so all tabs remain accessible on narrow screens.

No issues found.

---

### TC-02: Each tab shows skeleton while loading

**Expected:** Skeleton loaders matching the form layout are shown until `useTenantConfig` resolves
**Code path:** Each component's `if (isLoading) return <XxxSkeleton />` guard

**Result: PASS**

Every component implements an `isLoading` guard that returns a dedicated skeleton before the form renders.

| Component | Skeleton | Shape Match |
|-----------|----------|-------------|
| SchoolProfileSettings | ProfileSkeleton | 6 label+field pairs + 1 button — matches 6 form fields |
| GradingScaleForm | AcademicSkeleton | 4 rows + button — adequate |
| AssessmentWeightsForm | AcademicSkeleton (reused) | Adequate |
| OperationsSettings | OpsSkeleton | 8 label+field pairs + button |
| FeeSettings | FeeSkeleton | 7 label+field pairs + button |
| AttendanceSettings | AttSkeleton | 5 label+field pairs + button |
| PromotionSettings | PromoSkeleton | 6 label+field pairs + button |
| ReportCardSettings | RCSkeleton | 8 switch rows — correctly matches toggle-row layout |

Minor observation: `AcademicSkeleton` is shared between `GradingScaleForm` and `AssessmentWeightsForm`. The grading scale form is substantially more complex (table with rows). A table-shaped skeleton would be more accurate but this is cosmetic only.

---

### TC-03: School Profile — change country → other fields auto-update

**Expected:** Selecting a country from the dropdown updates calendarType, timezone, and locale fields automatically
**Code path:** `SchoolProfileSettings.tsx` lines 121–129, `countryPresets` lines 35–46

**Result: PASS**

`handleCountryChange` correctly calls `form.setValue` for `calendarType`, `timezone`, and `locale` when a country with a matching entry in `countryPresets` is selected. The `onValueChange` of the country `Select` routes through this handler.

One edge case: if a user types a custom country value (not in `countryPresets`), no preset is applied and the existing values stay — this is the correct behaviour.

---

### TC-04: Grading Scale — preset selector loads preset rows

**Expected:** Selecting a grading preset (e.g. IGCSE) replaces the scale table rows with the preset values
**Code path:** `AcademicSettings.tsx` lines 169–174, `useFieldArray.replace` line 172

**Result: PASS**

`handlePresetChange` calls `replace(GRADING_PRESETS[value])` which replaces the `scale` field array with the selected preset rows. This correctly triggers re-render of the table. Selecting `'Custom'` leaves the existing rows untouched.

The `preset` state variable (`useState('Custom')`) tracks the selected preset label in the dropdown. On page load from API data, the preset dropdown will show `'Custom'` even if the saved scale matches an existing preset — this is a cosmetic gap, not a functional bug.

---

### TC-05: Assessment Weights — CA% slider auto-calculates Exam%

**Expected:** Moving the CA% slider changes Exam% display to `100 - CA%` in real time
**Code path:** `AcademicSettings.tsx` `GroupEditor` lines 470–471

**Result: PASS WITH DEFECT**

The `examWeight` display at line 471 (`const examWeight = 100 - (Number(caWeight) || 0)`) is computed reactively from `form.watch`. The display updates in real time.

**Defect:** The CA weight field uses `<Input type="range" ... />` (`AcademicSettings.tsx:520`) rather than shadcn `<Slider>`. The `Input` component is a styled `<input type="text">` wrapper; using `type="range"` on it produces an unstyled native range slider that ignores the Tailwind/shadcn design tokens. The slider is functional but visually broken in dark mode and does not match the design system.

This defect is cosmetic/design-system — the auto-calculation logic itself is correct.

---

### TC-06: Operations — working day checkboxes work

**Expected:** Toggling a day checkbox adds or removes it from the working days array; Zod validates at least one day is selected
**Code path:** `OperationsSettings.tsx` lines 119–125, 140–156

**Result: PASS WITH DEFECT**

`toggleDay` correctly mutates the `workingDays` array via `form.setValue`. The Zod schema requires `z.array(z.string()).min(1)` so attempting to save with zero days selected will fail validation.

**Defect:** The checkboxes are not wrapped in a `<FormField>` component (`OperationsSettings.tsx` lines 138–156). Validation errors on `workingDays` are displayed via a manual `form.formState.errors.workingDays.message` check rather than through `<FormMessage />` inside a `FormField`. This means the error element lacks the `aria-describedby` association that shadcn Form provides, breaking accessibility. The error message will still render visually but will not be announced by screen readers.

---

### TC-07: Fee Settings — custom currency input appears when Custom selected

**Expected:** Selecting "Custom" from the currency dropdown reveals a free-text input for the custom currency code
**Code path:** `FeeSettings.tsx` lines 84, 186–221

**Result: PASS WITH DEFECT**

The `showCustomCurrency` flag is set to `true` via `onValueChange` when the user selects `'Custom'`, and the `customCurrency` input renders conditionally. On initial load from API, the `useEffect` at lines 103–122 correctly sets `showCustomCurrency` if the stored currency is not in the `CURRENCIES` list.

**Defect (data integrity):** The `customCurrency` field is `z.string().optional()`. If a user selects `'Custom'` and leaves the input blank, the mutation falls back silently to `'USD'` (`values.customCurrency ?? 'USD'`) without any validation error. The form should reject an empty `customCurrency` when `currency === 'Custom'`. This is a data correctness bug — a school could unknowingly save `USD` as their currency when they intended to enter a custom code.

**Defect (state drift):** `showCustomCurrency` is managed as `useState` rather than derived from `form.watch('currency') === 'Custom'`. If `form.reset` is called externally (e.g. after a failed save + refetch), the local state may not update synchronously. The current `useEffect` mitigates this but it is an unnecessary complexity.

---

### TC-08: Promotion — re-exam attempts field hidden when re-exam disabled

**Expected:** The "Max Re-exam Attempts" field is not visible when the "Re-exam Allowed" switch is off
**Code path:** `PromotionSettings.tsx` lines 109, 199–213

**Result: PASS**

`const reExamAllowed = form.watch('reExamAllowed')` is reactive. The `reExamMaxAttempts` `FormField` is rendered inside `{reExamAllowed && (...)}`. Toggling the switch hides/shows the field immediately.

No issues found.

---

### TC-09: Every save shows success toast

**Expected:** After a successful PUT, `toast.success(t('settings.saved'))` fires for every component
**Code path:** Each component's `mutation.onSuccess` handler

**Result: PASS**

Every component's `useMutation` `onSuccess` callback calls both `refetch()` and `toast.success(t('settings.saved'))`. Error case calls `toast.error(t('settings.save_error'))`. The `Button` is disabled while `mutation.isPending` to prevent double-submission. Text changes to `t('common.actions.loading')` during pending state.

---

### TC-10: All settings persist after page refresh (data comes from API)

**Expected:** After saving and refreshing the page, the saved values are re-loaded from the API via `useTenantConfig`, and the form populates with the stored values
**Code path:** `useEffect` + `form.reset` in every component; `refetch()` in `onSuccess`

**Result: PASS**

All components use the `useEffect([configs.xxx, form])` pattern to call `form.reset` when the config data loads. After a save, `refetch()` invalidates the cache and re-fetches, causing the effect to fire again with the new values. The `defaultValues` in `useForm` are only used before the first load; subsequent resets come from the API response.

One robustness note: if `configs.general` (or other category) is `undefined` on initial load (i.e. the tenant has never saved settings), the `useEffect` guard `if (configs.general)` means the form keeps its `defaultValues`. The `defaultValues` are sensible (Ethiopia/GREGORIAN/UTC for profile) so this is an acceptable fallback, not a bug.

---

## Attendance Mode Duplication — Design Concern

`OperationsSettings.tsx` and `AttendanceSettings.tsx` both expose an `attendanceMode` / `mode` field with the same `DAILY | PER_PERIOD | BOTH` options. These appear to map to different config categories (`operations` vs `attendance`). If the backend uses a single source of truth for this value, saving one tab without saving the other could result in inconsistency. This should be verified against the backend schema — if both write to the same field, one of the UI fields should be removed.

---

## Defect Summary

| ID | TC | Severity | Component | Description |
|----|----|----------|-----------|-------------|
| D-01 | TC-05 | Medium | AcademicSettings | `<Input type="range">` instead of shadcn `<Slider>` — visually broken in dark mode |
| D-02 | TC-06 | Low | OperationsSettings | Working-day checkboxes outside `<FormField>` — breaks screen reader accessibility |
| D-03 | TC-07 | **High** | FeeSettings | Empty `customCurrency` silently saves as `'USD'` — data integrity bug |
| D-04 | TC-07 | Low | FeeSettings | `showCustomCurrency` as `useState` instead of derived watch — potential state drift |
| D-05 | Design | Medium | OperationsSettings + AttendanceSettings | Duplicate `attendanceMode` field across two tabs — verify backend alignment |

---

## Pass/Fail Summary

| TC | Description | Result |
|----|-------------|--------|
| TC-01 | 7 tabs visible | PASS |
| TC-02 | Skeleton loaders | PASS |
| TC-03 | Country preset cascade | PASS |
| TC-04 | Grading scale preset | PASS |
| TC-05 | CA% slider auto-calc | PASS WITH DEFECT (D-01) |
| TC-06 | Working day checkboxes | PASS WITH DEFECT (D-02) |
| TC-07 | Custom currency input | PASS WITH DEFECT (D-03, D-04) |
| TC-08 | Re-exam attempts conditional | PASS |
| TC-09 | Success toast on save | PASS |
| TC-10 | Settings persist after refresh | PASS |

**Pass: 7 / 10 | Pass with defect: 3 / 10 | Fail: 0 / 10**

D-03 (custom currency empty → silent USD) is the only defect with data integrity impact and must be fixed before the feature goes to staging. D-01 (slider) and D-05 (duplicate mode field) are the next priority.
