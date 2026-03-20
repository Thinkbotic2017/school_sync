# SchoolSync — Phase-by-Phase Build Plan

## What's Already Built (Phases 1-4 + 6)

| Phase | Status | What's Done |
|-------|--------|------------|
| 1 | DONE | Auth, JWT, tenant isolation, RLS, dashboard shell, login |
| 2 | DONE | Students, classes, sections, subjects, academic years (CRUD) |
| 3 | DONE | RFID attendance, live monitor, daily marking, reports, Socket.IO, BullMQ |
| 4 | DONE | Fee structures, payments, invoices, financial reports, overdue detection |
| 6 | DONE | Dashboard API with aggregated stats |
| Security | DONE | RLS enforced (non-superuser), RFID encryption, upload validation, soft delete |

### Known Issues to Fix Before Proceeding

1. **Academic dropdowns broken** — student form, fee structure form, and filter dropdowns can't fetch academic years, classes, sections. Likely API response unwrapping or RLS issue.
2. **Academic pages not accessible** — only Students, Finance, and Attendance sidebar links work.
3. **No Settings page** — school admins can't configure their school.
4. **No Setup Wizard** — new tenants see empty pages with no guidance.
5. **Hardcoded assumptions** — grading scale, assessment weights, promotion rules not yet configurable.

---

## Phase 5: School Configuration Engine + Fix All Broken Pages

**Priority: CRITICAL — this unblocks everything**

### 5A: Fix All Broken Pages & APIs

- Debug and fix all academic module APIs (academic-years, classes, sections, subjects)
- Fix all dropdown fetching across student forms, fee forms, attendance filters
- Ensure every sidebar link navigates to a working page
- Add missing sidebar entries for academic management under "School Setup" section

### 5B: TenantConfig System

- Create `TenantConfig` table (tenantId, category, config JSON, updatedAt, updatedBy)
- Migrate existing hardcoded values into TenantConfig:
  - `SchoolConfig` → merge into TenantConfig category='operations'
  - `GradeScale` table → merge into TenantConfig category='grading'
- Backend: `GET/PUT /v1/config/:category` endpoints
- Cache config in Redis per tenant (invalidate on update)

### 5C: Settings Pages

- **School Profile** — name, logo, address, contact, calendar type, timezone
- **Academic Settings** — grading scale editor, assessment weight editor per grade group
- **Operations Settings** — working days, school hours, grace period, periods per day
- **Fee Settings** — currency, late penalty rules, clearance gates, payment methods, discount presets
- **Attendance Settings** — mode (daily/per-period), grace minutes
- **Promotion Rules** — minimum pass %, max failed subjects, auto-promote grades, re-exam policy
- **Notification Settings** — which events trigger notifications, which channels

### 5D: Setup Wizard

- Shown on first login for a new tenant (detected by: TenantConfig has no entries)
- 9-step wizard as defined in SCHOOL_OPERATIONS.md Section 1
- Each step saves to TenantConfig
- Can be re-accessed from Settings
- At the end, creates the academic year, grades, sections, and subjects automatically

---

## Phase 7: Exam & Grading Engine

**Dependency: Phase 5 (needs configurable grading scales and assessment weights)**

### 7A: Exam Management

- Exam CRUD: create exam (name, type, term, grades, date range)
- Per-subject exam scheduling (date, time, duration, room)
- Exam status lifecycle: DRAFT → SCHEDULED → IN_PROGRESS → GRADING → PUBLISHED

### 7B: Gradebook (Continuous Assessment)

- Teacher gradebook page: select class → subject → assessment category
- Mark entry grid: all students × mark field
- Auto-calculates running CA average based on configured weights
- Validation: marks cannot exceed configured maximum
- Lock marks after deadline (admin can unlock)

### 7C: Result Calculation Engine

- Service that calculates per student:
  - CA total (weighted sum of all assessment categories)
  - Exam total
  - Subject total = CA × weight + Exam × weight
  - Grade letter (from school's grading scale)
  - Pass/fail per subject
  - Overall average
  - Rank (section + grade, if enabled for this grade level)
- Triggered: manually by admin or auto after all marks entered

### 7D: Result Dashboard

- Per-class result summary: pass rate, average score, subject-wise analysis
- Per-student result view: all subjects, marks, grades, rank
- Comparative charts: class vs class, term vs term

---

## Phase 8: Report Card Generation

**Dependency: Phase 7 (needs calculated results)**

### 8A: Report Card Template Engine

- Template builder: drag-and-drop sections (header, student info, marks table, summary, remarks, signatures)
- Configurable: which fields to show/hide (from TenantConfig category='reportCard')
- Multi-language support (primary + secondary language)
- School branding: logo, colors, header text

### 8B: Report Card Generation

- Batch generate for entire class/grade
- Individual generate for single student
- Output: PDF (print-ready A4)
- Admin review and approval workflow
- Digital delivery to parent portal

### 8C: Report Card Distribution

- Track distribution status per student (generated → printed → distributed → acknowledged)
- Parent acknowledgment (digital signature or checkbox)
- Fee clearance gate: block report card if fees outstanding (if configured)

---

## Phase 9: Student Promotion Engine

**Dependency: Phase 7 + Phase 8 (needs results + report cards)**

### 9A: Year-End Verification

- Data completeness checker: all exams graded? all CA entered? attendance finalized?
- Missing data report with links to fix

### 9B: Promotion Processing

- Apply promotion rules from TenantConfig
- Auto-categorize: PROMOTED / RETAINED / REVIEW_NEEDED
- Admin review interface for borderline cases
- Override capability with reason logging
- Fee clearance verification

### 9C: New Year Transition

- Create new academic year (copy settings from previous)
- Batch promote students to next grade
- Graduate highest-grade students
- Section assignment tool (alphabetical, random, performance-based, or manual drag-and-drop)
- Archive old year (read-only)

---

## Phase 10: Admission Pipeline

**Dependency: Phase 5 (needs school configuration)**

- Application form (public-facing, no login required)
- Application tracking with pipeline stages
- Entrance exam scheduling and score recording
- Interview scheduling and notes
- Acceptance/rejection workflow
- Waitlist management with position tracking
- Fee payment linked to admission acceptance
- Auto-create student record on enrollment
- Document checklist tracking

---

## Phase 11: Timetable Management

**Dependency: Phase 5 (needs subjects, periods per week, teacher assignments)**

- Visual grid editor: days × periods
- Drag-and-drop subjects into slots
- Conflict detection: teacher double-booking, room double-booking
- Subject hour compliance (configured periods per week vs scheduled)
- Substitution management: absent teacher → reassign from available pool
- Student timetable view (auto-generated from class timetable)
- Teacher timetable view (aggregated from all their classes)

---

## Phase 12: Communication Hub

**Dependency: Phase 5 (needs notification settings)**

- Announcement CRUD with targeting (all school / grade / section / individual)
- SMS integration (pluggable provider: Ethio Telecom stub, Twilio, Africa's Talking)
- Push notification via Firebase FCM
- In-app notification center with read/unread
- Message templates (configurable per event type, per language)
- Parent-teacher messaging (1:1)
- Scheduled announcements (send at specific time)

---

## Phase 13: Transport Module

**Dependency: Phase 3 (uses RFID infrastructure)**

- Route CRUD with ordered stops (GPS coordinates)
- Bus CRUD with driver assignment
- Student-to-route assignment
- Bus RFID attendance (boarding/alighting)
- GPS tracking ingestion + real-time map
- Geofence notifications (bus approaching stop)
- Transport fee billing (separate from tuition)

---

## Phase 14: Flutter Mobile App (Parent Portal)

**Dependency: Phases 5-8 (needs all core features)**

- Parent login (same JWT auth)
- Child dashboard: attendance, grades, fees, homework
- Real-time bus tracking map
- Push notifications
- Fee payment status
- Report card view (digital)
- Teacher messaging
- Attendance history calendar view
- Offline caching (view last-synced data without internet)

---

## Phase 15: Pi Agent (RFID Reader)

**Dependency: Phase 3 (attendance API exists)**

- See docs/PI_AGENT_SPEC.md for full specification
- Python app on Raspberry Pi
- USB HID reader + 16x2 LCD
- Offline-first with SQLite + sync queue
- Sync API endpoints: /v1/sync/health, /v1/sync/students, /v1/sync/attendance-bulk

---

## Phase 16: Homework & Assignments

- Teacher creates homework: title, description, subject, class/section, due date, attachments
- Student submits: text + file upload (via mobile app or web)
- Teacher grades: marks + feedback
- Auto-calculates homework contribution to CA (based on assessment weight config)
- Parent view: pending homework, submitted, graded

---

## Phase 17: Teacher & Staff Management

- Teacher profiles: qualifications, subjects, classes assigned
- Staff profiles: role, department, contact
- Teacher assignment to class-subjects
- Teacher performance dashboard (optional): attendance rate, gradebook completion rate
- Leave management (basic: apply, approve, substitute assignment)

---

## Phase 18: Advanced Analytics & EMIS Export

- School-wide KPI dashboard with drill-down
- Year-over-year comparison charts
- Cohort tracking: follow students across years
- EMIS export: Annual School Census data in government format
- Custom report builder (select fields → generate CSV/PDF)

---

## Recommended Build Order (Next Steps)

```
NOW:  Phase 5  → School Config Engine + Fix Broken Pages + Setup Wizard
THEN: Phase 7  → Exam & Grading Engine
THEN: Phase 8  → Report Card Generation
THEN: Phase 9  → Student Promotion Engine
THEN: Phase 10 → Admission Pipeline
THEN: Phase 11 → Timetable
THEN: Phase 14 → Flutter Mobile App (parallel with Phase 11)
THEN: Phase 15 → Pi Agent (parallel with Phase 14)
THEN: Phase 12 → Communication Hub
THEN: Phase 13 → Transport
THEN: Phase 16 → Homework
THEN: Phase 17 → Teacher/Staff Management
THEN: Phase 18 → Analytics & EMIS
```

Phase 5 is the CRITICAL PATH — everything else depends on the configuration engine being right.
