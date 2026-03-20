# SchoolSync — School Operations & Module Specifications

This document defines how every module works from a BUSINESS perspective. Read this BEFORE building any module. The system is FULLY GENERIC — any country, any school system. Ethiopia is the default configuration for MSquare.

---

## Core Design Principle: Configuration-Driven

Every school configures their own:
- **Calendar system** (Gregorian, Ethiopian, Hijri, or custom)
- **Grade structure** (KG1-12, Year 1-13, Grade 1-10, or any custom structure)
- **Grading scale** (Ethiopian A-F, IGCSE A*-G, IB 1-7, American GPA, or custom)
- **Assessment weighting** (60/40 CA/Exam, 50/50, or any custom split per grade)
- **Fee categories** (tuition, transport, lab, uniform, books — any number of custom categories)
- **Promotion rules** (minimum pass %, max failed subjects, auto-promote certain grades)
- **Working days** (Mon-Fri, Sun-Thu, or custom)
- **Term structure** (2 semesters, 3 terms, 4 quarters, or custom)
- **Report card template** (layout, language, fields shown)
- **Attendance mode** (daily only, or per-period)
- **Currency** (ETB, USD, INR, or any ISO currency)

These are stored in a `TenantConfig` table (JSON blob per config category) — NOT hardcoded anywhere.

---

## 1. School Onboarding (Setup Wizard)

### First-Time Setup Flow

When a new tenant is created (by MSquare partner admin), the school admin sees a setup wizard on first login:

```
Step 1: School Profile
  → School name, logo, address, phone, email
  → Country → auto-sets: currency, calendar, timezone, locale
  → School type: Primary (1-6), Secondary (7-12), K-12, KG only, Custom
  → Auto-generates grade levels based on school type

Step 2: Academic Year
  → Start date + end date
  → System auto-names it: "2025-2026" (Gregorian) or "2018 E.C." (Ethiopian)
  → Number of terms: 2 semesters / 3 terms / 4 quarters
  → Term dates (auto-calculated, admin can adjust)
  → Holiday list (import country defaults + add custom)

Step 3: Grade Levels & Sections
  → Shows auto-generated grades (e.g., KG1, KG2, Grade 1-8)
  → Admin can: rename, add, remove, reorder
  → For each grade: set number of sections (A, B, C...) + max capacity per section
  → Section naming: A/B/C, I/II/III, Red/Blue/Green, or custom

Step 4: Subjects & Curriculum
  → For each grade level, define subjects:
    - Subject name (+ localized name)
    - Subject code
    - Type: Core / Elective / Extracurricular
    - Periods per week
  → Import from template (Ethiopian MOE standard, British curriculum, etc.) or create custom

Step 5: Grading & Assessment
  → Pick a grading scale preset:
    - Ethiopian (A: 90-100, B: 80-89, C: 60-79, D: 50-59, F: <50)
    - IGCSE (A*-G)
    - IB (1-7)
    - American GPA (A: 4.0, B: 3.0, etc.)
    - Custom (define your own scale)
  → Assessment weighting per grade group:
    - Grades 1-4: 100% continuous assessment (no final exam)
    - Grades 5-8: 60% CA + 40% final exam
    - Grades 9-12: 50% CA + 50% final exam
    - Or any custom split
  → Assessment categories: Quizzes, Assignments, Mid-term, Projects, Final Exam, Participation
  → Weight per category (must sum to 100% within CA and Exam groups)

Step 6: Fee Structure
  → Define fee categories: Tuition, Registration, Transport, Lab, Uniform, Books, Exam, Activity
  → For each category:
    - Amount (in school's currency)
    - Frequency: Monthly / Quarterly / Per-term / Semester / Annual / One-time
    - Applies to: All grades, specific grades, or specific grade groups
    - Optional: different amounts per grade level
  → Payment methods accepted: Cash, Bank Transfer, Mobile Money, Cheque, Online
  → Late payment policy: grace days, penalty percentage, penalty cap
  → Discount presets: sibling discount %, full-payment discount %, merit scholarship

Step 7: Promotion Rules
  → Minimum overall average to pass: 50% (configurable)
  → Maximum failed subjects allowed: 2 (configurable)
  → Auto-promote grades: 1-4 (configurable — Ethiopian MOE mandates this)
  → Re-exam policy: allowed / not allowed / allowed once
  → Rank calculation: enabled from Grade 7+ (configurable)
  → What happens on fail: Retain in same grade / Conditional promotion / Admin decides

Step 8: School Operations
  → Working days: Mon-Fri / Sun-Thu / Custom checkboxes
  → School hours: start time, end time
  → Attendance grace period: 15 minutes (configurable)
  → Attendance mode: Daily only / Per-period / Both
  → Number of periods per day: 7 (configurable)
  → Period duration: 45 minutes (configurable)
  → Break durations and times

Step 9: Review & Activate
  → Summary of all settings
  → "Activate School" button → school is live
  → Settings can be changed later from Settings page
```

### Subsequent Academic Years

After the first year, admin clicks "Start New Academic Year" which:
1. Creates new academic year with dates
2. **Copies from previous year:** grade structure, sections, subjects, fee templates, assessment weights, promotion rules, teacher assignments, timetable framework
3. Admin reviews and adjusts the copied data
4. Admin triggers "Student Promotion" workflow (see Section 8)
5. New year is activated

---

## 2. Student Lifecycle

### Admission Pipeline

```
Application → Assessment → Interview → Decision → Fee Payment → Enrollment → Class Assignment
```

Each stage is a status on the `Admission` record:
- **APPLIED** — parent submitted application form + documents + application fee
- **ASSESSMENT_SCHEDULED** — entrance exam date set
- **ASSESSED** — exam completed, scores recorded
- **INTERVIEW_SCHEDULED** — interview date set
- **INTERVIEWED** — interview completed, notes recorded
- **ACCEPTED** — offer extended, awaiting fee payment
- **WAITLISTED** — no space, on waiting list (with position number)
- **REJECTED** — application declined (with reason)
- **FEE_PAID** — registration + first tuition paid
- **ENROLLED** — student record created, assigned to class + section
- **WITHDRAWN** — withdrew before enrollment

Priority rules (configurable per school):
- Siblings of existing students get priority
- Staff children get priority
- Early applicants get priority
- Or no priority — first come first served

### Student Statuses

| Status | Meaning |
|--------|---------|
| ACTIVE | Currently enrolled and attending |
| INACTIVE | Temporarily withdrawn (can re-enroll) |
| GRADUATED | Completed the school's highest grade |
| TRANSFERRED_OUT | Transferred to another school (needs fee clearance) |
| DROPPED_OUT | Left without formal transfer |
| SUSPENDED | Disciplinary suspension (temporary) |
| EXPELLED | Permanently removed |
| PROMOTED | Promoted to next grade (temporary status during year-end) |
| RETAINED | Failed, repeating current grade |

### What Carries Forward Each Year

| Data | Carries Forward? |
|------|-----------------|
| Personal info (name, DOB, photo, parents) | Yes |
| Cumulative academic history | Yes (read-only archive) |
| Health/vaccination records | Yes |
| Disciplinary records | Yes |
| Current-year grades/marks | No — archived, new year starts fresh |
| Attendance records | No — archived |
| Section assignment | No — reassigned each year |
| Fee records | No — new fee records generated |
| RFID card number | Yes (same card, follows student) |

---

## 3. Academic Year Operations (Daily Cycle)

### Attendance Flow

**Morning (homeroom teacher):**
```
Teacher opens Attendance page → selects their class/section (auto-detected from assignment)
→ Today's date auto-selected
→ Shows all students with status toggles: Present / Absent / Late / Excused
→ "Mark All Present" button (most common action)
→ Toggle individual students who are absent/late
→ Save → system records attendance with source=MANUAL
→ Absent students' parents get notification (configurable: SMS, push, or both)
```

**RFID (at school gate):**
```
Student taps card → Pi agent sends to API → system processes:
  - First tap today = CHECK_IN (status: PRESENT or LATE based on time)
  - Second tap = CHECK_OUT
  - Parent notified of check-in/check-out
```

**Per-period attendance (secondary grades, if enabled):**
```
Subject teacher marks attendance for their period
→ Records: studentId + date + periodNumber + status
→ Daily status = worst status across all periods (absent in any = absent for day)
```

### Continuous Assessment

Teachers enter marks throughout the term:
```
Gradebook page → Select class/section → Select subject → Select assessment category
→ Shows all students with mark entry fields
→ Enter marks (out of configured maximum)
→ Auto-calculates running average based on configured weights
→ Save
```

Assessment categories are configurable per grade group:
```
Grade 1-4 (example):
  Quizzes: 20% of total
  Assignments: 30% of total
  Projects: 20% of total
  Participation: 30% of total
  (No final exam — 100% CA)

Grade 5-8 (example):
  Continuous Assessment (60%):
    Quizzes: 15%
    Assignments: 15%
    Mid-term Exam: 15%
    Projects: 15%
  Final Exam (40%):
    Written Exam: 40%
```

### Timetable

Timetable is configured per class/section:
```
Admin/Principal creates timetable:
→ Grid view: Days (columns) × Periods (rows)
→ Drag-and-drop subjects into slots
→ System checks conflicts:
  - Teacher already assigned to another class in same period
  - Room already booked (if room management is enabled)
  - Subject exceeds configured periods per week
→ Supports double periods (consecutive slots for labs, etc.)
→ Substitution management: when teacher is absent, reassign period to available teacher
```

---

## 4. Examination System

### Exam Lifecycle

```
Create Exam → Schedule → Enter Marks → Calculate Results → Generate Report Cards → Publish
```

**Exam types:**
- Mid-term / Mid-semester exam
- Final / End-of-term exam
- Supplementary / Re-exam
- Class test (continuous assessment)

**Exam creation:**
```
Admin creates exam:
→ Name: "Mid-Term Exam - Semester 1"
→ Type: MID_TERM / FINAL / SUPPLEMENTARY
→ Academic year + term
→ Applicable grades
→ Date range (start date - end date)
→ Per-subject exam schedule (date + time + duration + room)
```

**Mark entry:**
```
Teacher enters marks:
→ Select exam → Select subject → Select class/section
→ Shows all students
→ Enter mark (out of configured maximum, e.g., 100)
→ System validates: mark ≤ maximum, not negative
→ Auto-calculates: percentage, grade letter (from school's grading scale)
→ Save → marks are locked after deadline (admin can unlock for corrections)
```

**Result calculation:**
```
System calculates per student:
→ For each subject:
  - CA marks (weighted sum of all continuous assessments)
  - Exam marks
  - Total = (CA × CA_weight) + (Exam × Exam_weight)
  - Grade letter from grading scale
→ Semester/term average
→ Annual average (average of semester averages)
→ Section rank (if enabled for this grade level)
→ Grade-level rank (if enabled)
→ Pass/fail status per subject
→ Overall pass/fail (based on promotion rules)
```

---

## 5. Report Card Generation

Report cards are **template-based** — each school defines their template:

**Template fields (all configurable show/hide):**
- School header (logo, name, address, motto)
- Student info (name, ID, class, section, roll number, photo)
- Per-subject marks table:
  - Subject name
  - CA marks
  - Exam marks
  - Total marks
  - Grade letter
  - Teacher remarks per subject (optional)
- Summary: overall average, rank, attendance percentage
- Conduct/behavior grade
- Class teacher remarks
- Principal remarks
- Promotion status: PROMOTED / RETAINED / CONDITIONAL
- Signature lines: class teacher, principal, parent
- School stamp space

**Output formats:** PDF (for printing), digital (view in parent portal)

**Language:** Primary language + secondary language (e.g., Amharic + English)

---

## 6. Fee Management

### Fee Lifecycle

```
Define Fee Structure → Generate Fee Records → Collect Payments → Track Outstanding → Enforce Clearance
```

**Fee structure** is per academic year, per grade (or all grades):
```
School defines:
→ Fee Category: "Tuition Fee"
→ Amount: 5000 (in school's currency)
→ Frequency: Monthly
→ Applies to: All grades (or specific grades)
→ Due day: 5th of each month
→ Late penalty: 2.5% after 15 days grace
```

**Fee record generation:**
```
When admin clicks "Generate Records" on a fee structure:
→ System creates a FeeRecord for every ACTIVE student in the applicable grades
→ Calculates due dates based on frequency
→ Applies any existing discounts (sibling, scholarship, etc.)
→ Students who already have a record for this fee structure are skipped
```

**Payment recording:**
```
Cashier/accountant records payment:
→ Select student → shows all outstanding fees
→ Enter amount received
→ Select payment method: Cash / Bank Transfer / Mobile Money / Cheque
→ Enter receipt number (auto-generated or manual)
→ System applies payment to oldest unpaid fee first (FIFO)
→ If payment covers full amount → status = PAID
→ If partial → status = PARTIAL
→ Generate receipt / invoice
```

**Fee clearance gates (configurable):**
- Cannot receive report card if fees outstanding
- Cannot receive transfer certificate if fees outstanding
- Cannot enroll for next year if fees outstanding
- Cannot sit for exams if fees outstanding (some schools)

---

## 7. Communication Hub

### Notification Events (Auto-triggered)

| Event | Recipients | Channels |
|-------|-----------|----------|
| Student marked absent | Parent(s) | SMS + Push |
| Student checked in (RFID) | Parent(s) | Push |
| Student checked out (RFID) | Parent(s) | Push |
| Fee payment due (7 days before) | Parent(s) | SMS + Push |
| Fee overdue | Parent(s) | SMS + Push |
| Exam results published | Parent(s) | Push + In-app |
| New homework assigned | Parent(s) + Student | Push + In-app |
| School announcement | All parents / specific classes | SMS + Push + In-app |
| Bus arriving at stop | Parent(s) | Push |
| Disciplinary incident | Parent(s) | SMS + In-app |

### Announcement System

```
Admin/teacher creates announcement:
→ Title + content (rich text)
→ Target: All school / Specific grades / Specific sections / Specific parents
→ Priority: Normal / Urgent
→ Channels: In-app only / In-app + Push / In-app + Push + SMS
→ Schedule: Send now / Schedule for later
→ Attachments: files, images
```

---

## 8. Year-End Process (Promotion Workflow)

This is the most critical workflow. It's a guided multi-step process:

```
Step 1: Verify Data Completeness
  → System checks: all exams graded? all CA marks entered? attendance finalized?
  → Shows missing data report: "Grade 3-A: Science final exam marks not entered"
  → Admin must resolve all gaps before proceeding

Step 2: Calculate Final Results
  → System runs calculation for all students:
    - Semester averages, annual averages
    - Subject pass/fail based on school's minimum
    - Overall pass/fail based on promotion rules
    - Ranks (where enabled)
  → Admin reviews results dashboard

Step 3: Generate Report Cards
  → System generates report cards for all students
  → Admin can preview, adjust remarks, approve
  → Print batch or distribute digitally

Step 4: Promotion Decision
  → System shows three lists:
    - AUTO-PROMOTED: students who meet all criteria
    - AUTO-RETAINED: students who clearly failed
    - REVIEW NEEDED: borderline cases
  → Admin reviews borderline cases, decides: promote / retain / conditional
  → Admin can override any auto-decision with reason

Step 5: Verify Fee Clearance
  → Shows students with outstanding fees
  → These students cannot be promoted until cleared
  → Admin can override with reason (e.g., scholarship pending)

Step 6: Process Transfers & Graduates
  → Students in the highest grade → marked GRADUATED
  → Transfer-out requests → generate transfer certificates
  → Dropouts → marked appropriately

Step 7: Create New Academic Year
  → Set dates for new year
  → System copies: grade structure, subjects, fee templates, settings
  → Admin adjusts as needed

Step 8: Batch Promote Students
  → Promoted students → moved to next grade level
  → Retained students → stay in current grade
  → System creates new class rosters for the new year
  → Section assignment: auto (alphabetical/random/performance) or manual

Step 9: Section Assignment
  → For each grade, admin reviews and adjusts section assignments
  → Can drag-and-drop students between sections
  → System enforces max capacity per section

Step 10: New Year Activation
  → Admin clicks "Activate New Year"
  → Old year becomes read-only archive
  → New year becomes active
  → All modules now operate in the new year context
```

---

## 9. Transport Module

```
Route Management:
  → Define routes with ordered stops (name + GPS coordinates + estimated times)
  → Assign buses to routes
  → Assign students to routes + stops

Bus Tracking:
  → GPS device on bus sends location every 30 seconds
  → Real-time map view for admin and parents
  → Geofence alerts: notify parents when bus is 500m from their stop

Bus Attendance:
  → RFID reader on bus
  → Card tap on boarding = BOARDING event
  → Card tap on alighting = ALIGHTING event
  → Parent notified on both
  → Separate from school attendance
```

---

## 10. Multi-School (Partner Admin)

MSquare (or any reseller partner) has a Partner Admin dashboard:

```
Partner Dashboard:
  → View all schools under management
  → Create new school tenant (triggers setup wizard)
  → Manage subscriptions and license keys
  → View aggregated analytics across all schools
  → White-label branding configuration (logo, colors, domain)
  → Billing management
```

---

## 11. TenantConfig Schema

Instead of separate tables for every configurable aspect, use a JSON configuration model:

```typescript
// TenantConfig stores all school-specific configuration
// Category examples: 'grading', 'assessment', 'promotion', 'attendance', 'fees', 'operations'

TenantConfig {
  id: string
  tenantId: string
  category: string        // 'grading' | 'assessment' | 'promotion' | 'attendance' | etc.
  config: JSON            // The configuration object
  updatedAt: DateTime
  updatedBy: string       // User who last changed it
}

// Example configs:

// category: 'grading'
{
  "scale": [
    { "letter": "A", "min": 90, "max": 100, "gpa": 4.0, "description": "Excellent" },
    { "letter": "B", "min": 80, "max": 89, "gpa": 3.0, "description": "Very Good" },
    { "letter": "C", "min": 60, "max": 79, "gpa": 2.0, "description": "Good" },
    { "letter": "D", "min": 50, "max": 59, "gpa": 1.0, "description": "Pass" },
    { "letter": "F", "min": 0, "max": 49, "gpa": 0.0, "description": "Fail" }
  ],
  "passingGrade": "D",
  "minimumPassPercentage": 50
}

// category: 'assessment'
{
  "gradeGroups": [
    {
      "name": "Lower Primary",
      "grades": ["Grade 1", "Grade 2", "Grade 3", "Grade 4"],
      "caWeight": 100,
      "examWeight": 0,
      "categories": [
        { "name": "Quizzes", "weight": 20 },
        { "name": "Assignments", "weight": 30 },
        { "name": "Projects", "weight": 20 },
        { "name": "Participation", "weight": 30 }
      ]
    },
    {
      "name": "Upper Primary",
      "grades": ["Grade 5", "Grade 6", "Grade 7", "Grade 8"],
      "caWeight": 60,
      "examWeight": 40,
      "categories": [
        { "name": "Quizzes", "weight": 15 },
        { "name": "Assignments", "weight": 15 },
        { "name": "Mid-term", "weight": 15 },
        { "name": "Projects", "weight": 15 }
      ]
    }
  ]
}

// category: 'promotion'
{
  "minimumOverallAverage": 50,
  "maximumFailedSubjects": 2,
  "autoPromoteGrades": ["Grade 1", "Grade 2", "Grade 3", "Grade 4"],
  "reExamAllowed": true,
  "reExamMaxAttempts": 1,
  "rankingEnabledFromGrade": "Grade 7"
}

// category: 'operations'
{
  "workingDays": ["MON", "TUE", "WED", "THU", "FRI"],
  "schoolStartTime": "08:00",
  "schoolEndTime": "15:30",
  "graceMinutes": 15,
  "periodsPerDay": 7,
  "periodDurationMinutes": 45,
  "attendanceMode": "DAILY",
  "breaks": [
    { "name": "Morning Break", "afterPeriod": 2, "duration": 15 },
    { "name": "Lunch", "afterPeriod": 4, "duration": 60 }
  ]
}

// category: 'fees'
{
  "currency": "ETB",
  "latePenalty": { "graceDays": 15, "penaltyPercent": 2.5, "maxPenaltyPercent": 10 },
  "clearanceRequired": ["REPORT_CARD", "TRANSFER_CERTIFICATE", "NEXT_YEAR_ENROLLMENT"],
  "paymentMethods": ["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CHEQUE"],
  "discounts": {
    "sibling": { "2nd": 0, "3rd": 5, "4th": 10 },
    "fullPaymentAnnual": 5
  }
}

// category: 'reportCard'
{
  "showRank": true,
  "showAttendance": true,
  "showConduct": true,
  "showTeacherRemarks": true,
  "showPrincipalRemarks": true,
  "showPhoto": false,
  "languages": ["en", "am"],
  "primaryLanguage": "en"
}
```

---

## 12. User Roles

| Role | Access Level |
|------|-------------|
| SUPER_ADMIN | Platform-level (Infosware) — all tenants |
| PARTNER_ADMIN | MSquare — manages their schools, creates tenants |
| SCHOOL_ADMIN | Full school access — all modules + settings |
| PRINCIPAL | Academic oversight, student management, reports |
| VICE_PRINCIPAL | Timetable, substitutions, discipline |
| ACADEMIC_DIRECTOR | Curriculum, exams, grading, report cards |
| TEACHER | Their classes: attendance, gradebook, homework |
| HOMEROOM_TEACHER | Teacher + full access to their homeroom section |
| ACCOUNTANT | Finance module: fees, payments, invoices, reports |
| RECEPTIONIST | Front desk: visitor log, basic student lookup, attendance monitor |
| TRANSPORT_MANAGER | Bus routes, GPS, transport attendance, transport fees |
| BUS_DRIVER | Bus attendance only |
| PARENT | Read-only: their children's attendance, grades, fees, homework |
| STUDENT | Read-only: their own attendance, grades, homework submissions |
| LIBRARIAN | Library module (future) |
| NURSE | Health records (future) |

Roles are configurable — schools can create custom roles with specific permission sets.
