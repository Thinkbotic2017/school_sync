# QA Report
Date: 2026-03-19

## Test Results

| Test | Description | Result | Notes |
|------|-------------|--------|-------|
| 1a | Login Addis admin | FAIL (corrected) | Test script used wrong email `admin@addis-international.com`; actual seed email is `admin@addis.edu.et`. Login succeeded with correct credentials — see Note 1 |
| 1b | Login Hawassa admin | FAIL (corrected) | Test script used wrong email `admin@hawassa-academy.com`; actual seed email is `admin@hawassa.edu.et`. Login succeeded with correct credentials — see Note 1 |
| 2a | Addis sees 30 students | PASS | actual count: 30 |
| 2b | Hawassa sees 0 students (RLS isolation) | PASS | actual count: 0 — RLS is correctly isolating tenant data |
| 3a | Paginated student list | PASS | page=1 limit=5 returned 5 students; meta: total=30, totalPages=6 |
| 3b | Student search | PASS | search=Dawit returned 1 student (Dawit Bekele, AIS-2026-001) |
| 3c | Student detail | PASS | Full object returned with class, section, parentLinks, documents arrays |
| 3d | Soft delete | PASS | DELETE returned `{"success":true,"data":null}`; subsequent GET shows status=INACTIVE, record still in DB |
| 4a | Academic years | PASS | 1 year returned: "2025-2026 (2018 E.C.)", isCurrent=true, calendarType=ETHIOPIAN |
| 4b | Classes | PASS | 3 classes returned: Grade 1, Grade 2, Grade 3 with section and student counts |
| 4c | Sections for Grade 1 | PASS | 2 sections returned: A (5 students) and B (5 students) |
| 4d | Subjects | PASS | 6 subjects returned with Amharic nameAmharic field populated (e.g., ሂሳብ, አማርኛ, እንግሊዝኛ) |
| 5  | Response format | PASS | All responses follow `{"success":true,"data":[...],"meta":{"page":N,"limit":N,"total":N,"totalPages":N}}` |
| 6a | Backend tsc --noEmit | NOT RUN | Bash sandbox blocked tsc/npx/pnpm execution — must be run manually |
| 6b | Frontend pnpm build | NOT RUN | Bash sandbox blocked build command execution — must be run manually |

---

## Note 1 — Credential Mismatch (Documentation Bug)

The test script specified these emails:
- `admin@addis-international.com`
- `admin@hawassa-academy.com`

The actual seed file (`packages/backend/prisma/seed.ts`) creates these emails:
- `admin@addis.edu.et` (Addis International School)
- `admin@hawassa.edu.et` (Hawassa Academy)

The test plan emails do not match the seeded credentials. All subsequent tests were run with the correct seeded emails. **The test plan documentation must be updated to reflect the actual seeded credentials.**

---

## Note 2 — Soft Delete Behaviour

After DELETE, calling GET by ID still returns the student record with `status: "INACTIVE"`. The list endpoint (`GET /v1/students`) correctly excludes INACTIVE students from results (count drops from 30 to 29 after deletion). This is correct soft-delete behaviour.

---

## Note 3 — Build Verification Could Not Be Automated

The sandbox environment used for this QA run blocks execution of `tsc`, `npx`, `pnpm build`, and similar build tools. Tests 6a and 6b must be run manually:

```bash
# Backend TypeScript check
cd packages/backend && npx tsc --noEmit

# Frontend build
cd packages/frontend && pnpm build
```

---

## Blockers

None. No BLOCKER issues found. RLS tenant isolation is functioning correctly — Hawassa Academy returns zero students and cannot see Addis International data.

---

## Additional Observations

1. **Student detail response** includes `parentLinks: []` for Nigest Abay (AIS-2026-029). This is expected — only 10 of the 30 students have parent links created in the seed. Students beyond index 9 have no linked parents.
2. **All 6 subjects** have `nameAmharic` values populated with Ge'ez script characters, confirming i18n groundwork is in place.
3. **Classes response** includes `_count.sections` and `_count.students`, which is useful for the frontend dashboard.
4. **Subjects response** includes `_count.classSubjects` (each subject shows 3, one per grade), confirming curriculum assignment is working.
5. **Standard response format** is consistent across all endpoints tested.

---

## Summary

- Tests passed: 11/13 (2 not run due to sandbox restrictions)
- Tests with documentation mismatch (credentials): 2 (marked FAIL initially, corrected)
- Blockers: 0
- Ready for staging: **CONDITIONALLY YES** — pending manual verification of tests 6a and 6b (TypeScript and frontend build). All API and RLS tests pass.
