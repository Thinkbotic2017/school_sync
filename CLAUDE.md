# CLAUDE.md — School Management System (SMS) for Ethiopia

## Project Identity

- **Project Name:** SchoolSync — White-Label School Management Platform
- **Client Partner:** MSquare (Ethiopia) — Desalegn Birhanu
- **Development Partner:** Infosware Solutions Pvt. Ltd. (India) — Mayank Parihar
- **Business Model:** White-label SaaS — MSquare resells under their own branding in Ethiopia
- **Target Market:** Private, international, and government schools in Ethiopia

---

## Tech Stack

| Layer            | Technology                                                       |
| ---------------- | ---------------------------------------------------------------- |
| Backend          | Node.js + Express.js + TypeScript                                |
| Frontend (Admin) | React 18 + TypeScript + Vite + Tailwind CSS v4                   |
| UI Components    | shadcn/ui (Radix primitives) — MANDATORY                         |
| Data Tables      | TanStack Table + shadcn DataTable pattern                        |
| Data Fetching    | TanStack React Query (server state cache)                        |
| Forms            | React Hook Form + @hookform/resolvers + Zod                      |
| State Management | Zustand (client state only)                                      |
| i18n (Frontend)  | react-i18next + i18next-browser-languagedetector                 |
| Fonts            | Fontsource (Noto Sans Ethiopic Variable + display font)          |
| Charts           | Recharts (dashboard analytics)                                   |
| Mobile App       | Flutter (Dart) — Parent & Student Portal                         |
| Database         | PostgreSQL 15+ (multi-tenant, RLS)                               |
| ORM              | Prisma                                                           |
| Cache            | Redis                                                            |
| Auth             | JWT (access + refresh tokens) + bcrypt                           |
| File Storage     | S3-compatible (AWS S3 or MinIO for self-host)                    |
| Real-time        | Socket.IO (attendance events, notifications)                     |
| Task Queue       | BullMQ (Redis-backed)                                            |
| API Docs         | Swagger / OpenAPI 3.0                                            |
| Testing          | Jest (backend) + React Testing Library (frontend) + Flutter test |
| CI/CD            | GitHub Actions                                                   |
| Containerization | Docker + Docker Compose                                          |
| Reverse Proxy    | Nginx                                                            |

### Reference Implementation

Clone **satnaing/shadcn-admin** (11,400+ GitHub stars) as the frontend reference. It uses our exact stack (Vite + React + TypeScript + shadcn/ui) with 10+ pre-built admin pages, light/dark mode, global search command palette, and WAI-ARIA accessibility. Use it as the structural template — NOT the design.
DO NOT run any git commands. I will handle git myself.

---

## Skills & Plugins (Claude Code Configuration)

### Installation Commands (Run on Day 1)

```bash
# ===== OFFICIAL ANTHROPIC MARKETPLACE =====
/plugin install frontend-design@claude-plugins-official
/plugin install code-review@claude-plugins-official
/plugin install feature-dev@claude-plugins-official
/plugin install commit-commands@claude-plugins-official
/plugin install code-simplifier@claude-plugins-official
/plugin install claude-md-management@claude-plugins-official
/plugin install hookify@claude-plugins-official
/plugin install github@claude-plugins-official
/plugin install context7@claude-plugins-official
/plugin install playwright@claude-plugins-official
/plugin install firebase@claude-plugins-official

# ===== ANTI-AI-SLOP FRONTEND SKILLS =====
# Impeccable — 20 slash commands for design auditing (/audit, /polish, /critique, /typeset, /animate, /colorize)
npx skills add pbakaus/impeccable

# Taste-Skill — tunable design dials (DESIGN_VARIANCE, MOTION_INTENSITY, VISUAL_DENSITY)
# Set VISUAL_DENSITY=8-10 for data-dense admin dashboards
# Includes redesign-skill that audits existing pages for AI slop patterns
git clone https://github.com/Leonxlnx/taste-skill.git
cp -r taste-skill/.claude/skills/* .claude/skills/

# Official shadcn/ui skill — reads components.json, prevents hallucinated props
pnpm dlx skills add shadcn/ui

# shadcn MCP server — live component registry access
claude mcp add --transport http shadcn https://www.shadcn.io/api/mcp

# ShadcnBlocks — 2,500+ pre-built UI blocks across 71 categories
git clone https://github.com/masonjames/Shadcnblocks-Skill.git
cp -r Shadcnblocks-Skill/.claude/skills/* .claude/skills/

# Vercel agent-skills — web design guidelines + React best practices + composition patterns
npx skills add vercel-labs/agent-skills

# Interface-design — stores design decisions in .interface-design/system.md for cross-session consistency
git clone https://github.com/Dammyjay93/interface-design.git
cp -r interface-design/.claude/skills/* .claude/skills/

# ===== ENGINEERING SKILLS (Community) =====
/plugin marketplace add alirezarezvani/claude-skills
/plugin install engineering-skills@claude-code-skills
/plugin install engineering-advanced-skills@claude-code-skills
/plugin install skill-security-auditor@claude-code-skills

# ===== TRESOR TOOLKIT (Auto-triggering dev skills) =====
git clone https://github.com/alirezarezvani/claude-code-tresor.git
cd claude-code-tresor && ./scripts/install.sh && cd ..

# ===== MCP SERVERS =====
# PostgreSQL — direct DB access for debugging, verifying RLS
claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres
# Context7 — live library docs (Prisma, Express, Socket.IO, BullMQ)
claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
# Sequential Thinking — step-by-step reasoning for complex flows
claude mcp add sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking
# GitHub — PRs, issues, CI/CD from terminal
claude mcp add github -- npx -y @modelcontextprotocol/server-github

# ===== RELOAD =====
/reload-plugins
```

### What Each Skill Layer Does

| Layer                   | Skills                                                   | Purpose                                                                   |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Aesthetic Direction** | `frontend-design` + `impeccable` + `taste-skill`         | Forces bold design choices, bans generic aesthetics, provides audit tools |
| **Component Accuracy**  | `shadcn/ui skill` + `shadcn MCP` + `ShadcnBlocks`        | Prevents hallucinated props, provides 2,500+ pre-built blocks             |
| **Quality Enforcement** | `vercel agent-skills` + `interface-design`               | 100+ web design rules, React optimization, cross-session design memory    |
| **Code Quality**        | `code-review` + `code-simplifier` + `engineering-skills` | Multi-agent PR review, security auditing, dependency scanning             |
| **Dev Workflow**        | `feature-dev` + `commit-commands` + `hookify` + `tresor` | Feature scaffolding, smart commits, auto-test generation, secret scanning |
| **Infrastructure**      | `postgres` + `context7` + `github` + `firebase` MCPs     | Direct DB access, live docs, GitHub integration, push notification setup  |

---

## Frontend Design System (Anti-AI-Slop Rules)

### CRITICAL: Read This Before Writing ANY Frontend Code

Claude tends to converge toward generic, statistically average UI output. In frontend design, this creates what users call "AI slop" — Inter font, purple gradients, rounded cards, cookie-cutter layouts. This project MUST NOT look AI-generated. Every page should look like a professional designer built it.

### Design Principles

1. **Commit to a bold aesthetic direction BEFORE writing code** — not after. Choose from: brutally minimal, maximalist, retro-futuristic, luxury, editorial, brutalist, art deco, or define a custom direction in `.impeccable.md`
2. **Typography is identity** — choose fonts that are beautiful, unique, and distinctive. BANNED fonts: Inter, Roboto, Arial, Helvetica, Open Sans, Lato, Poppins. For English UI, pick a distinctive sans-serif. For Amharic, use Noto Sans Ethiopic Variable exclusively
3. **Dominant color with sharp accents** — a cohesive palette with one strong primary and contrasting accents beats timid, evenly-distributed colors. Use CSS variables via shadcn theming for consistency
4. **Motion creates delight** — one well-orchestrated page load with staggered reveals > scattered micro-interactions. Use Framer Motion or CSS transitions for entrance animations, hover states, and page transitions
5. **Backgrounds create atmosphere** — subtle gradients, grain textures, or depth layers instead of flat solid white/gray
6. **Density matches context** — admin dashboards should be information-dense (not wastefully spaced). Parent portal can be more spacious and friendly
7. **Be prescriptive about principles, not pixels** — specify design direction and constraints, not exact hex codes. Let the aesthetic emerge naturally

### Component Rules (MANDATORY)

```
ALWAYS use shadcn/ui for:
  Button, Card, Dialog, Sheet, Table, DataTable, Form, Input, Select,
  Textarea, Badge, Tabs, Sidebar, Command, Sonner (toasts), AlertDialog,
  DropdownMenu, Popover, Tooltip, Avatar, Skeleton, Separator, Switch,
  Checkbox, RadioGroup, Calendar, DatePicker

NEVER use:
  - Raw HTML <input>, <select>, <table>, <button> — always shadcn wrappers
  - Material UI, Ant Design, Chakra UI, or any other component library
  - Custom-built components when a shadcn primitive exists
  - <form> elements without react-hook-form + zod integration
```

### Data Tables (Every CRUD Module)

```typescript
// ALWAYS use TanStack Table + shadcn DataTable pattern
// Every list page MUST include:
// - Column sorting (clickable headers)
// - Server-side pagination (page, limit, total)
// - Search/filter bar
// - Bulk actions (select rows → bulk delete/export)
// - Column visibility toggle
// - Loading skeleton state (NOT spinner)
// - Empty state with illustration + CTA
// - Row click → navigate to detail page
```

### Forms (Every Create/Edit Page)

```typescript
// ALWAYS use react-hook-form + zod + shadcn Form
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Every form MUST include:
// - Zod schema for validation (shared with backend when possible)
// - FormField + FormItem + FormLabel + FormControl + FormMessage wrappers
// - Loading state on submit button
// - Toast notification on success/failure (Sonner)
// - Unsaved changes warning before navigation
// - Proper keyboard navigation (tab order, enter to submit)
```

### Dashboard Design (Role-Based)

```
SCHOOL_ADMIN dashboard:
  - KPI cards row: total students, total staff, attendance %, fee collection %
  - Attendance trend chart (last 30 days, Recharts AreaChart)
  - Recent activity feed (admissions, payments, announcements)
  - Quick actions: add student, mark attendance, create announcement

TEACHER dashboard:
  - My classes today (with timetable)
  - Pending homework submissions count
  - Quick attendance entry shortcut
  - Recent exam results overview

PARENT dashboard:
  - Child's attendance this week (visual calendar)
  - Latest exam results
  - Fee payment status + due dates
  - Bus tracking map (if transport module active)
  - Recent messages from school
```

### Status Badge Colors (Consistent Across All Modules)

```
Active / Present / Paid     → green   (bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300)
Inactive / Absent / Overdue → red     (bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300)
Pending / Partial / Late    → yellow  (bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300)
Info / Excused / Trial      → blue    (bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300)
```

### Amharic (Ge'ez Script) Typography Rules

```css
/* Noto Sans Ethiopic Variable — install via Fontsource */
/* pnpm add @fontsource-variable/noto-sans-ethiopic */

:root {
  --font-ethiopic: "Noto Sans Ethiopic Variable", sans-serif;
  --font-display: /* your chosen English display font */;
  --font-body: /* your chosen English body font */;
}

/* Amharic text needs larger sizing and more line height than Latin */
[lang="am"] {
  font-family: var(--font-ethiopic);
  font-size: 1rem; /* 16px minimum for body — Ge'ez chars are complex */
  line-height: 1.7; /* vs 1.5 for English */
  letter-spacing: 0.01em; /* slight spacing helps readability */
}

[lang="en"] {
  font-family: var(--font-body);
  font-size: 0.875rem;
  line-height: 1.5;
}
```

**Important:** Amharic is LEFT-TO-RIGHT (not RTL like Arabic). No directional layout changes needed. However, Amharic text is typically 20-40% wider than English equivalents — test all UI containers for overflow when switching languages.

### Design Persistence (Cross-Session Consistency)

Use the `interface-design` skill to store design decisions in `.interface-design/system.md`. This file persists across Claude Code sessions and ensures every new page matches the established design:

```markdown
# .interface-design/system.md (auto-generated by interface-design skill)

- Primary color: [chosen]
- Surface depth strategy: [flat/layered/glassmorphism]
- Border radius scale: [sharp/soft/pill]
- Spacing base: [4px/8px grid]
- Animation style: [subtle/expressive/minimal]
- Shadow depth: [none/subtle/dramatic]
- Information density: [compact/comfortable/spacious]
```

Also use `.impeccable.md` for project-specific aesthetic constraints (auto-generated by the `/teach-impeccable` command).

### Anti-Patterns Checklist (Run Before Every PR)

Use `/audit` (Impeccable) or the taste-skill redesign checker to catch:

- [ ] Inter/Roboto/Arial used anywhere
- [ ] Purple gradients on white backgrounds
- [ ] Generic "John Doe" placeholder data (use realistic Ethiopian names)
- [ ] Perfectly round numbers in dashboards (47.2% not 99.99%)
- [ ] Cookie-cutter card layouts with no visual hierarchy
- [ ] Missing loading skeletons (no empty states, no spinners)
- [ ] Missing dark mode support
- [ ] Hardcoded English strings (must be in i18n)
- [ ] Amharic text overflowing containers
- [ ] No hover/focus states on interactive elements
- [ ] Forms without validation error messages
- [ ] Tables without empty state messaging

---

## Architecture Overview

### Multi-Tenant SaaS (Single DB, Tenant Isolation via RLS)

```
┌─────────────────────────────────────────────────────┐
│                    Nginx (Reverse Proxy)             │
│              SSL Termination + Subdomain Routing     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  React Admin  │  │  Flutter App │  │  API Docs │ │
│  │  (Web Portal) │  │  (Mobile)    │  │ (Swagger) │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │       │
│  ┌──────▼─────────────────▼─────────────────▼─────┐ │
│  │           Express.js REST API                   │ │
│  │     Middleware: Auth → Tenant → RLS Context     │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  Services Layer (Business Logic per Module)     │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  Prisma ORM + PostgreSQL (Row-Level Security)   │ │
│  └──────┬──────────┬──────────┬───────────────────┘ │
│         │          │          │                     │
│  ┌──────▼──┐ ┌─────▼────┐ ┌──▼─────────┐          │
│  │  Redis  │ │  BullMQ  │ │  S3/MinIO  │          │
│  │ (Cache) │ │ (Queues) │ │ (Files)    │          │
│  └─────────┘ └──────────┘ └────────────┘          │
└─────────────────────────────────────────────────────┘
```

### Tenant Isolation Strategy

Every data table includes a `tenant_id` column. PostgreSQL Row-Level Security (RLS) policies ensure queries are automatically scoped to the current tenant. The tenant context is set per-request via middleware.

```sql
-- Example RLS policy
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON students
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### Subdomain Routing

Each tenant (school) gets a subdomain: `{school-slug}.schoolsync.app`
MSquare can white-label: `{school-slug}.msquare-edu.com` (or their own domain)

---

## Directory Structure

```
schoolsync/
├── CLAUDE.md                          # This file
├── CLAUDE.local.md                    # Personal instructions (gitignored)
├── .mcp.json                          # MCP server configurations
├── .impeccable.md                     # Design constraints (Impeccable skill — gitignored)
├── .interface-design/
│   └── system.md                      # Design tokens & decisions (interface-design skill)
├── docker-compose.yml                 # Full stack orchestration
├── docker-compose.dev.yml             # Dev overrides
├── .claude/
│   ├── settings.json                  # Project permissions & env
│   ├── settings.local.json            # Personal overrides (gitignored)
│   ├── skills/                        # Installed skills (taste-skill, ShadcnBlocks, etc.)
│   └── commands/                      # Custom slash commands
│       ├── migrate.md
│       ├── new-module.md
│       ├── new-page.md
│       ├── new-flutter-feature.md
│       ├── test.md
│       ├── review.md
│       ├── deploy.md
│       ├── seed.md
│       ├── lint.md
│       ├── rfid-debug.md
│       └── i18n.md
├── .github/
│   └── workflows/
│       ├── ci.yml                     # Lint + test on PR
│       └── deploy.yml                 # Deploy to staging/prod
│
├── packages/                          # Monorepo structure
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # Full DB schema
│   │   │   ├── migrations/            # Prisma migrations
│   │   │   └── seed.ts                # Seed data (demo school, admin user)
│   │   └── src/
│   │       ├── index.ts               # Express app entry
│   │       ├── config/
│   │       │   ├── database.ts        # Prisma client + RLS setup
│   │       │   ├── redis.ts           # Redis connection
│   │       │   ├── s3.ts              # File storage config
│   │       │   └── env.ts             # Environment validation (zod)
│   │       ├── middleware/
│   │       │   ├── auth.ts            # JWT verification
│   │       │   ├── tenant.ts          # Tenant resolution from subdomain/header
│   │       │   ├── rls.ts             # Set PostgreSQL RLS context per request
│   │       │   ├── rbac.ts            # Role-based access control
│   │       │   ├── rateLimiter.ts     # Per-tenant rate limiting
│   │       │   ├── validator.ts       # Zod request validation
│   │       │   └── errorHandler.ts    # Global error handler
│   │       ├── modules/
│   │       │   ├── auth/              # Login, register, password reset, token refresh
│   │       │   ├── tenant/            # Tenant CRUD, branding, config, subscription
│   │       │   ├── license/           # License management, plan tiers, usage tracking
│   │       │   ├── student/           # Student registration, profiles, documents
│   │       │   ├── admission/         # Admission workflow, applications, approvals
│   │       │   ├── academic/          # Subjects, curriculum, class allocation
│   │       │   ├── exam/              # Exam scheduling, grading, report cards
│   │       │   ├── attendance/        # RFID attendance, manual attendance, reports
│   │       │   ├── teacher/           # Teacher profiles, assignments, performance
│   │       │   ├── staff/             # Non-teaching staff management
│   │       │   ├── parent/            # Parent profiles, linked students
│   │       │   ├── finance/           # Fee structures, invoices, payments, reports
│   │       │   ├── transport/         # Bus routes, GPS tracking, RFID bus attendance
│   │       │   ├── notification/      # Pluggable: push, email, SMS, in-app
│   │       │   ├── communication/     # Messaging, announcements, circular
│   │       │   ├── timetable/         # Class timetable, teacher schedule
│   │       │   ├── homework/          # Assignment creation, submission, grading
│   │       │   ├── report/            # Report generation engine
│   │       │   └── dashboard/         # Role-based dashboards, analytics
│   │       │
│   │       │   # Each module follows this structure:
│   │       │   # ├── module.routes.ts
│   │       │   # ├── module.controller.ts
│   │       │   # ├── module.service.ts
│   │       │   # ├── module.validator.ts    (Zod schemas)
│   │       │   # ├── module.types.ts
│   │       │   # └── __tests__/
│   │       │
│   │       ├── services/              # Shared services
│   │       │   ├── notification/
│   │       │   │   ├── notification.service.ts      # Orchestrator
│   │       │   │   ├── providers/
│   │       │   │   │   ├── email.provider.ts        # Nodemailer / SES
│   │       │   │   │   ├── push.provider.ts         # Firebase FCM
│   │       │   │   │   ├── sms.provider.ts          # Abstract interface
│   │       │   │   │   ├── sms-ethio.provider.ts    # Ethio Telecom (stub — MSquare implements)
│   │       │   │   │   └── inapp.provider.ts        # In-app notifications via DB + Socket
│   │       │   │   └── notification.queue.ts        # BullMQ async dispatch
│   │       │   ├── rfid/
│   │       │   │   ├── rfid.service.ts              # RFID event processing
│   │       │   │   ├── hardware/
│   │       │   │   │   ├── reader.interface.ts      # Hardware abstraction
│   │       │   │   │   ├── mifare.adapter.ts        # Mifare Classic/Ultralight
│   │       │   │   │   └── nfc.adapter.ts           # NFC tag reader
│   │       │   │   └── rfid.websocket.ts            # Real-time card tap events
│   │       │   ├── storage/
│   │       │   │   └── storage.service.ts           # S3-compatible file ops
│   │       │   ├── report/
│   │       │   │   └── pdf.service.ts               # PDF generation (report cards, invoices)
│   │       │   └── localization/
│   │       │       ├── i18n.service.ts              # Language switching
│   │       │       ├── locales/
│   │       │       │   ├── en.json                  # English
│   │       │       │   └── am.json                  # Amharic
│   │       │       └── ethiopian-calendar.ts        # Ethiopian calendar utilities
│   │       └── utils/
│   │           ├── logger.ts                        # Winston structured logging
│   │           ├── pagination.ts                    # Cursor/offset pagination
│   │           ├── crypto.ts                        # Encryption utilities
│   │           └── constants.ts                     # App-wide constants
│   │
│   ├── frontend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── Dockerfile
│   │   ├── tailwind.config.js
│   │   ├── components.json                    # shadcn/ui configuration
│   │   ├── index.html
│   │   ├── .impeccable.md                     # Project design constraints (Impeccable skill)
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── globals.css                    # Tailwind directives + CSS variables + font imports
│   │       ├── routes/
│   │       │   └── index.tsx                        # React Router v6 route definitions
│   │       ├── layouts/
│   │       │   ├── DashboardLayout.tsx              # Sidebar + topbar shell (shadcn Sidebar)
│   │       │   ├── AuthLayout.tsx                   # Login/register layout
│   │       │   └── PublicLayout.tsx                 # Public pages (admission form)
│   │       ├── components/
│   │       │   ├── ui/                              # shadcn/ui primitives (auto-generated by CLI)
│   │       │   │   ├── button.tsx
│   │       │   │   ├── card.tsx
│   │       │   │   ├── data-table.tsx               # TanStack Table + shadcn wrapper
│   │       │   │   ├── dialog.tsx
│   │       │   │   ├── form.tsx                     # react-hook-form + shadcn integration
│   │       │   │   ├── input.tsx
│   │       │   │   ├── select.tsx
│   │       │   │   ├── sidebar.tsx
│   │       │   │   ├── skeleton.tsx
│   │       │   │   ├── sonner.tsx                   # Toast notifications
│   │       │   │   ├── table.tsx
│   │       │   │   └── ...                          # All other shadcn primitives
│   │       │   ├── custom/                          # Project-specific compound components
│   │       │   │   ├── StatusBadge.tsx               # Consistent status badges across modules
│   │       │   │   ├── KPICard.tsx                   # Dashboard stat card
│   │       │   │   ├── PageHeader.tsx                # Page title + breadcrumb + actions
│   │       │   │   ├── EmptyState.tsx                # Illustration + message + CTA
│   │       │   │   ├── ConfirmDialog.tsx             # AlertDialog wrapper for destructive actions
│   │       │   │   ├── DataTableToolbar.tsx          # Search + filters + column visibility
│   │       │   │   ├── LanguageSwitcher.tsx          # EN/AM toggle
│   │       │   │   └── ThemeToggle.tsx               # Light/dark mode
│   │       │   ├── forms/                           # Form components (student form, fee form, etc.)
│   │       │   └── charts/                          # Dashboard chart components (Recharts)
│   │       ├── pages/
│   │       │   ├── auth/                            # Login, ForgotPassword, ResetPassword
│   │       │   ├── dashboard/                       # Role-based dashboard
│   │       │   ├── students/                        # Student CRUD, bulk import, profile view
│   │       │   ├── admission/                       # Application management
│   │       │   ├── academic/                        # Subjects, curriculum, class management
│   │       │   ├── exams/                           # Exam setup, grading, report cards
│   │       │   ├── attendance/                      # Live monitor, reports, manual entry
│   │       │   ├── teachers/                        # Teacher management
│   │       │   ├── staff/                           # Staff management
│   │       │   ├── parents/                         # Parent management
│   │       │   ├── finance/                         # Fee structure, invoices, payment records
│   │       │   ├── transport/                       # Routes, GPS map, bus attendance
│   │       │   ├── communication/                   # Messages, announcements, circulars
│   │       │   ├── timetable/                       # Schedule management
│   │       │   ├── homework/                        # Assignment management
│   │       │   ├── reports/                         # Report generation
│   │       │   └── settings/                        # School config, branding, users, roles
│   │       ├── hooks/                               # Custom hooks (useAuth, useTenant, usePermission, useDebounce)
│   │       ├── services/                            # API client (Axios instance with interceptors + React Query hooks)
│   │       ├── store/                               # Zustand stores (auth, sidebar, locale — client state ONLY)
│   │       ├── i18n/                                # react-i18next config + locale files
│   │       ├── types/                               # Shared TypeScript types
│   │       └── utils/                               # Helpers, formatters, constants
│   │
│   ├── mobile/
│   │   ├── pubspec.yaml
│   │   ├── android/
│   │   ├── ios/
│   │   └── lib/
│   │       ├── main.dart
│   │       ├── app/
│   │       │   ├── routes.dart
│   │       │   ├── theme.dart
│   │       │   └── localization.dart
│   │       ├── core/
│   │       │   ├── api/                             # Dio HTTP client
│   │       │   ├── auth/                            # Token storage, auto-refresh
│   │       │   ├── models/                          # Data models
│   │       │   └── providers/                       # Riverpod state providers
│   │       ├── features/
│   │       │   ├── auth/                            # Login, biometric auth
│   │       │   ├── dashboard/                       # Parent/Student dashboard
│   │       │   ├── attendance/                      # Attendance view + notifications
│   │       │   ├── academics/                       # Grades, report cards
│   │       │   ├── homework/                        # Assignment tracking
│   │       │   ├── transport/                       # Bus tracking map
│   │       │   ├── communication/                   # Chat with teachers, announcements
│   │       │   ├── finance/                         # Fee status, payment history
│   │       │   └── profile/                         # Student/parent profile
│   │       └── widgets/                             # Shared Flutter widgets
│   │
│   └── shared/
│       ├── package.json
│       └── src/
│           ├── types/                               # Shared types (backend + frontend)
│           ├── constants/                           # Shared enums, roles, permissions
│           ├── validators/                          # Shared Zod schemas
│           └── utils/                               # Shared utilities
│
└── docs/
    ├── api.md                                       # API documentation
    ├── deployment.md                                # Deployment guide
    ├── rfid-integration.md                          # RFID hardware setup guide
    ├── localization.md                              # Adding new languages
    └── partner-onboarding.md                        # White-label partner setup guide
```

---

## Database Schema (Core Tables)

Use Prisma schema. Every tenant-scoped table includes `tenant_id` and RLS policy.

### Platform-Level Tables (No RLS — Super Admin only)

```prisma
model Tenant {
  id              String    @id @default(uuid())
  name            String                          // School name
  slug            String    @unique               // Subdomain: {slug}.schoolsync.app
  customDomain    String?   @unique               // MSquare's custom domain mapping
  logo            String?                         // S3 path
  primaryColor    String    @default("#1E40AF")   // Branding
  secondaryColor  String    @default("#3B82F6")
  plan            PlanType  @default(STARTER)     // STARTER, PROFESSIONAL, ENTERPRISE
  licenseKey      String    @unique
  licenseExpiresAt DateTime
  maxStudents     Int       @default(500)
  maxStaff        Int       @default(50)
  isActive        Boolean   @default(true)
  locale          String    @default("en")        // Default language
  calendarType    CalendarType @default(ETHIOPIAN) // ETHIOPIAN or GREGORIAN
  timezone        String    @default("Africa/Addis_Ababa")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  users           User[]
  subscriptionHistory SubscriptionHistory[]
}

model SubscriptionHistory {
  id          String    @id @default(uuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  plan        PlanType
  startDate   DateTime
  endDate     DateTime
  amount      Decimal
  currency    String    @default("ETB")
  status      SubscriptionStatus
  createdAt   DateTime  @default(now())
}

enum PlanType {
  STARTER        // Up to 500 students
  PROFESSIONAL   // Up to 2000 students + transport
  ENTERPRISE     // Unlimited + full features + API access
}

enum SubscriptionStatus {
  ACTIVE
  EXPIRED
  CANCELLED
  TRIAL
}

enum CalendarType {
  ETHIOPIAN
  GREGORIAN
}
```

### Tenant-Scoped Tables (RLS Enforced)

```prisma
model User {
  id            String    @id @default(uuid())
  tenantId      String
  tenant        Tenant    @relation(fields: [tenantId], references: [id])
  email         String
  phone         String?
  passwordHash  String
  firstName     String
  lastName      String
  role          UserRole
  isActive      Boolean   @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([tenantId, email])
  @@index([tenantId])
}

enum UserRole {
  SUPER_ADMIN      // Platform-level (Infosware)
  PARTNER_ADMIN    // MSquare admin
  SCHOOL_ADMIN     // School administrator
  PRINCIPAL
  TEACHER
  ACCOUNTANT
  PARENT
  STUDENT
  TRANSPORT_MANAGER
  BUS_DRIVER
  RECEPTIONIST
}

model Student {
  id                String    @id @default(uuid())
  tenantId          String
  admissionNumber   String
  rfidCardNumber    String?   @unique
  firstName         String
  lastName          String
  dateOfBirth       DateTime
  gender            Gender
  bloodGroup        String?
  nationality       String    @default("Ethiopian")
  photo             String?
  classId           String
  sectionId         String
  rollNumber        String?
  admissionDate     DateTime
  status            StudentStatus @default(ACTIVE)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  class             Class     @relation(fields: [classId], references: [id])
  section           Section   @relation(fields: [sectionId], references: [id])
  attendances       Attendance[]
  examResults       ExamResult[]
  feeRecords        FeeRecord[]
  parentLinks       ParentStudent[]
  documents         StudentDocument[]
  transportAssignment TransportAssignment?

  @@unique([tenantId, admissionNumber])
  @@index([tenantId])
  @@index([rfidCardNumber])
}

model Class {
  id          String    @id @default(uuid())
  tenantId    String
  name        String                              // e.g., "Grade 1", "KG-1"
  numericOrder Int                                // For sorting
  academicYearId String
  sections    Section[]
  students    Student[]
  subjects    ClassSubject[]

  @@unique([tenantId, name, academicYearId])
  @@index([tenantId])
}

model Section {
  id          String    @id @default(uuid())
  tenantId    String
  classId     String
  name        String                              // e.g., "A", "B", "C"
  capacity    Int       @default(40)
  class       Class     @relation(fields: [classId], references: [id])
  students    Student[]

  @@unique([tenantId, classId, name])
  @@index([tenantId])
}

model AcademicYear {
  id          String    @id @default(uuid())
  tenantId    String
  name        String                              // e.g., "2025-2026" or "2017 E.C."
  startDate   DateTime
  endDate     DateTime
  isCurrent   Boolean   @default(false)
  calendarType CalendarType

  @@unique([tenantId, name])
  @@index([tenantId])
}

model Subject {
  id          String    @id @default(uuid())
  tenantId    String
  name        String
  nameAmharic String?                             // Amharic name
  code        String
  type        SubjectType                         // CORE, ELECTIVE, EXTRACURRICULAR
  classSubjects ClassSubject[]

  @@unique([tenantId, code])
  @@index([tenantId])
}

model ClassSubject {
  id          String    @id @default(uuid())
  tenantId    String
  classId     String
  subjectId   String
  teacherId   String?
  class       Class     @relation(fields: [classId], references: [id])
  subject     Subject   @relation(fields: [subjectId], references: [id])
  periodsPerWeek Int    @default(5)

  @@unique([tenantId, classId, subjectId])
  @@index([tenantId])
}

model Attendance {
  id          String    @id @default(uuid())
  tenantId    String
  studentId   String
  date        DateTime  @db.Date
  status      AttendanceStatus
  checkInTime DateTime?
  checkOutTime DateTime?
  source      AttendanceSource                    // RFID, MANUAL, APP
  rfidReaderId String?
  student     Student   @relation(fields: [studentId], references: [id])

  @@unique([tenantId, studentId, date])
  @@index([tenantId])
  @@index([tenantId, date])
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  HALF_DAY
  EXCUSED
}

enum AttendanceSource {
  RFID
  MANUAL
  APP
}

model Exam {
  id          String    @id @default(uuid())
  tenantId    String
  name        String                              // e.g., "Mid-Term Exam 1"
  academicYearId String
  termId      String?
  startDate   DateTime
  endDate     DateTime
  results     ExamResult[]

  @@index([tenantId])
}

model ExamResult {
  id          String    @id @default(uuid())
  tenantId    String
  examId      String
  studentId   String
  subjectId   String
  marksObtained Decimal
  maxMarks    Decimal
  grade       String?
  remarks     String?
  exam        Exam      @relation(fields: [examId], references: [id])
  student     Student   @relation(fields: [studentId], references: [id])

  @@unique([tenantId, examId, studentId, subjectId])
  @@index([tenantId])
}

model GradeScale {
  id          String    @id @default(uuid())
  tenantId    String
  name        String                              // e.g., "A", "B", "C", "D", "F"
  minPercent  Decimal
  maxPercent  Decimal
  gpa         Decimal?
  description String?                             // "Excellent", "Very Good", etc.

  @@index([tenantId])
}

model FeeStructure {
  id          String    @id @default(uuid())
  tenantId    String
  name        String                              // "Tuition Fee", "Transport Fee", "Lab Fee"
  amount      Decimal
  currency    String    @default("ETB")
  frequency   FeeFrequency                        // MONTHLY, QUARTERLY, SEMESTER, ANNUAL, ONE_TIME
  classId     String?                             // Null = applies to all classes
  academicYearId String
  isActive    Boolean   @default(true)

  @@index([tenantId])
}

model FeeRecord {
  id              String    @id @default(uuid())
  tenantId        String
  studentId       String
  feeStructureId  String
  amount          Decimal
  dueDate         DateTime
  paidAmount      Decimal   @default(0)
  paidDate        DateTime?
  status          FeeStatus @default(PENDING)
  invoiceNumber   String?
  paymentMethod   String?                         // CASH, BANK_TRANSFER, MOBILE_MONEY, etc.
  receiptNumber   String?
  remarks         String?
  student         Student   @relation(fields: [studentId], references: [id])

  @@index([tenantId])
  @@index([tenantId, status])
}

enum FeeStatus {
  PENDING
  PARTIAL
  PAID
  OVERDUE
  WAIVED
}

enum FeeFrequency {
  ONE_TIME
  MONTHLY
  QUARTERLY
  SEMESTER
  ANNUAL
}

model ParentStudent {
  id          String    @id @default(uuid())
  tenantId    String
  parentId    String                              // User with PARENT role
  studentId   String
  relationship String                             // FATHER, MOTHER, GUARDIAN
  isPrimary   Boolean   @default(false)
  student     Student   @relation(fields: [studentId], references: [id])

  @@unique([tenantId, parentId, studentId])
  @@index([tenantId])
}

model StudentDocument {
  id          String    @id @default(uuid())
  tenantId    String
  studentId   String
  name        String                              // "Birth Certificate", "Transfer Certificate"
  filePath    String                              // S3 path
  fileType    String
  uploadedAt  DateTime  @default(now())
  student     Student   @relation(fields: [studentId], references: [id])

  @@index([tenantId])
}

// ---------- Transport Module ----------

model Bus {
  id            String    @id @default(uuid())
  tenantId      String
  busNumber     String
  licensePlate  String
  capacity      Int
  driverId      String?                           // User with BUS_DRIVER role
  gpsDeviceId   String?                           // GPS tracker device ID
  isActive      Boolean   @default(true)
  routes        BusRoute[]

  @@unique([tenantId, busNumber])
  @@index([tenantId])
}

model BusRoute {
  id          String    @id @default(uuid())
  tenantId    String
  name        String                              // "Route A - North"
  busId       String
  bus         Bus       @relation(fields: [busId], references: [id])
  stops       BusStop[]
  assignments TransportAssignment[]

  @@index([tenantId])
}

model BusStop {
  id          String    @id @default(uuid())
  tenantId    String
  routeId     String
  name        String
  latitude    Decimal
  longitude   Decimal
  stopOrder   Int
  pickupTime  String?                             // "07:30"
  dropTime    String?                             // "15:30"
  route       BusRoute  @relation(fields: [routeId], references: [id])

  @@index([tenantId])
}

model TransportAssignment {
  id          String    @id @default(uuid())
  tenantId    String
  studentId   String    @unique
  routeId     String
  stopId      String
  student     Student   @relation(fields: [studentId], references: [id])
  route       BusRoute  @relation(fields: [routeId], references: [id])

  @@index([tenantId])
}

model BusGPSLog {
  id          String    @id @default(uuid())
  tenantId    String
  busId       String
  latitude    Decimal
  longitude   Decimal
  speed       Decimal?
  heading     Decimal?
  recordedAt  DateTime  @default(now())

  @@index([tenantId, busId, recordedAt])
}

model BusAttendance {
  id          String    @id @default(uuid())
  tenantId    String
  studentId   String
  busId       String
  type        BusAttendanceType                   // BOARDING, ALIGHTING
  rfidCardNumber String
  recordedAt  DateTime  @default(now())

  @@index([tenantId, busId, recordedAt])
}

enum BusAttendanceType {
  BOARDING
  ALIGHTING
}

// ---------- Communication ----------

model Notification {
  id          String    @id @default(uuid())
  tenantId    String
  userId      String
  title       String
  body        String
  type        NotificationType
  channel     NotificationChannel
  isRead      Boolean   @default(false)
  metadata    Json?                               // Extra data (attendance details, fee info, etc.)
  sentAt      DateTime  @default(now())

  @@index([tenantId, userId, isRead])
}

enum NotificationType {
  ATTENDANCE_CHECKIN
  ATTENDANCE_CHECKOUT
  BUS_BOARDING
  BUS_ARRIVAL
  FEE_DUE
  FEE_PAID
  EXAM_RESULT
  HOMEWORK_ASSIGNED
  ANNOUNCEMENT
  GENERAL
}

enum NotificationChannel {
  PUSH
  EMAIL
  SMS
  IN_APP
}

model Announcement {
  id          String    @id @default(uuid())
  tenantId    String
  title       String
  content     String
  authorId    String
  targetRole  UserRole?                           // Null = all users
  targetClassId String?                           // Null = all classes
  attachments Json?
  publishedAt DateTime  @default(now())

  @@index([tenantId])
}

// ---------- Homework ----------

model Homework {
  id          String    @id @default(uuid())
  tenantId    String
  title       String
  description String
  classId     String
  sectionId   String?
  subjectId   String
  teacherId   String
  dueDate     DateTime
  attachments Json?                               // S3 paths
  submissions HomeworkSubmission[]
  createdAt   DateTime  @default(now())

  @@index([tenantId])
}

model HomeworkSubmission {
  id          String    @id @default(uuid())
  tenantId    String
  homeworkId  String
  studentId   String
  content     String?
  attachments Json?
  grade       String?
  feedback    String?
  submittedAt DateTime  @default(now())
  gradedAt    DateTime?
  homework    Homework  @relation(fields: [homeworkId], references: [id])

  @@unique([tenantId, homeworkId, studentId])
  @@index([tenantId])
}

// ---------- Timetable ----------

model Timetable {
  id          String    @id @default(uuid())
  tenantId    String
  classId     String
  sectionId   String
  dayOfWeek   Int                                 // 0=Monday (Ethiopian week starts Monday)
  periodNumber Int
  startTime   String                              // "08:00"
  endTime     String                              // "08:45"
  subjectId   String
  teacherId   String

  @@unique([tenantId, classId, sectionId, dayOfWeek, periodNumber])
  @@index([tenantId])
}
```

---

## API Design Conventions

### Base URL

```
https://api.schoolsync.app/v1
```

Tenant resolution via `X-Tenant-ID` header OR subdomain extraction.

### Authentication Flow

```
POST   /v1/auth/login                  → { accessToken, refreshToken }
POST   /v1/auth/refresh                → { accessToken }
POST   /v1/auth/forgot-password        → Send reset email
POST   /v1/auth/reset-password         → Reset with token
POST   /v1/auth/change-password        → Authenticated change
GET    /v1/auth/me                     → Current user profile
```

### REST Endpoints Pattern (per module)

```
GET    /v1/{resource}                  → List (paginated, filtered, sorted)
GET    /v1/{resource}/:id              → Get by ID
POST   /v1/{resource}                  → Create
PUT    /v1/{resource}/:id              → Update
DELETE /v1/{resource}/:id              → Soft delete
POST   /v1/{resource}/bulk             → Bulk create (CSV import)
GET    /v1/{resource}/export           → Export CSV/PDF
```

### Standard Response Format

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "email", "message": "Invalid email format" }]
  }
}
```

---

## Key Module Specifications

### 1. RFID Attendance System

**Hardware Stack (Supplied by Infosware):**

- Mifare Classic 1K / Mifare Ultralight cards
- NFC-compatible USB/Ethernet readers
- Reader communicates via serial/TCP to a local agent app
- Agent app sends card tap events to the API via WebSocket

**Flow:**

```
RFID Card Tap → Reader Hardware → Local Agent (Python/Node)
  → WebSocket → API Server → Process Attendance
  → Real-time Socket.IO event → Parent App Notification
  → BullMQ Job → Send Push + SMS (if configured)
```

**API Endpoints:**

```
POST   /v1/attendance/rfid-event       → Process card tap (from agent)
GET    /v1/attendance/live             → WebSocket stream for real-time monitor
GET    /v1/attendance/daily/:classId   → Daily class attendance
GET    /v1/attendance/report           → Attendance reports (date range, class, student)
POST   /v1/attendance/manual           → Manual attendance entry
PUT    /v1/attendance/:id              → Edit attendance record
```

**Business Rules:**

- First tap of the day = CHECK_IN, second tap = CHECK_OUT
- If check-in is after school start time + grace period → status = LATE
- Duplicate taps within 5 minutes = ignored (debounce)
- Parent notification sent within 10 seconds of check-in/check-out
- Unregistered card taps are logged for audit but not processed

### 2. Transport Module

**GPS Tracking:**

- GPS devices on buses send location every 30 seconds
- API endpoint ingests GPS data: `POST /v1/transport/gps-log`
- Real-time bus location pushed to parents via Socket.IO
- Geofence alerts: notify parents when bus is within 500m of their stop

**Bus RFID Attendance:**

- RFID reader on each bus
- Card tap on boarding = BOARDING event
- Card tap on alighting = ALIGHTING event
- Parent notified on both events

### 3. License Management (White-Label)

**Plan Tiers:**

| Feature           | Starter   | Professional     | Enterprise    |
| ----------------- | --------- | ---------------- | ------------- |
| Max Students      | 500       | 2,000            | Unlimited     |
| Max Staff         | 50        | 200              | Unlimited     |
| Modules           | Core only | Core + Transport | All           |
| Mobile App        | Yes       | Yes              | Yes           |
| SMS Notifications | No        | Yes              | Yes           |
| API Access        | No        | No               | Yes           |
| Custom Branding   | Basic     | Full             | Full + Domain |
| Support           | Email     | Priority         | Dedicated     |

**License Enforcement Middleware:**

```typescript
// Check on every tenant-scoped request
const checkLicense = async (req, res, next) => {
  const tenant = req.tenant;
  if (!tenant.isActive) throw new ForbiddenError("Tenant deactivated");
  if (tenant.licenseExpiresAt < new Date())
    throw new ForbiddenError("License expired");
  // Check module access based on plan
  if (req.path.includes("/transport") && tenant.plan === "STARTER") {
    throw new ForbiddenError("Transport module not available on Starter plan");
  }
  // Check student/staff limits
  next();
};
```

**Partner Admin Dashboard (MSquare):**

- View all schools under their management
- Create new school tenants
- Manage subscriptions and license keys
- View aggregated analytics across schools
- White-label branding configuration

### 4. Localization

**Ethiopian Calendar Support:**

- Ethiopian calendar is ~7-8 years behind Gregorian
- New Year starts on September 11 (or 12 in leap years)
- 13 months: 12 months of 30 days + 1 month of 5-6 days
- Use library: `ethiopian-calendar` or custom conversion utility
- All date displays toggle based on tenant's `calendarType` setting
- Academic year follows Ethiopian calendar by default

**Amharic Language & Ge'ez Script:**

- Use react-i18next (frontend) and custom i18n service (backend)
- All UI strings externalized to locale JSON files via `t()` function
- Amharic uses Ge'ez script — ensure UTF-8 everywhere
- Amharic is LEFT-TO-RIGHT (not RTL like Arabic) — no directional layout changes needed
- PDF report generation must support Ge'ez script fonts (use Noto Sans Ethiopic)

**Font Stack:**

- Install via Fontsource: `pnpm add @fontsource-variable/noto-sans-ethiopic`
- Amharic body text: minimum 16px, line-height 1.7, letter-spacing 0.01em
- English body text: 14px, line-height 1.5
- Amharic text is typically 20-40% wider than English — test ALL containers for overflow
- Use CSS `[lang="am"]` and `[lang="en"]` selectors for language-specific typography
- Never hardcode font sizes in components — use CSS variables that respond to locale

**Ethiopian Grading System:**

- Schools may use different grading scales
- Common: A (90-100), B (80-89), C (70-79), D (60-69), F (below 60)
- Configurable per tenant via GradeScale table

**i18n Key Naming Convention:**

```
module.page.element → e.g., students.list.title, attendance.status.present
common.actions.save, common.actions.cancel, common.actions.delete
common.errors.required, common.errors.invalid_email
```

### 5. Notification System (Pluggable Architecture)

```typescript
// Abstract provider interface
interface NotificationProvider {
  send(recipient: string, message: NotificationPayload): Promise<boolean>;
  sendBulk(recipients: string[], message: NotificationPayload): Promise<BulkResult>;
}

// Implementations
class EmailProvider implements NotificationProvider { ... }     // Nodemailer/SES
class PushProvider implements NotificationProvider { ... }      // Firebase FCM
class InAppProvider implements NotificationProvider { ... }     // DB + Socket.IO
class SMSProvider implements NotificationProvider { ... }       // Abstract — stub

// Ethio Telecom stub (MSquare to implement)
class EthioTelecomSMSProvider extends SMSProvider {
  async send(phone: string, message: NotificationPayload): Promise<boolean> {
    // TODO: MSquare to provide Ethio Telecom SMS API credentials and implementation
    // Expected: HTTP POST to Ethio Telecom gateway
    // Phone format: +251XXXXXXXXX
    throw new Error('Ethio Telecom SMS integration not yet configured');
  }
}
```

**Notification Events (triggered automatically):**

- Student RFID check-in/check-out → Push + SMS to parent
- Bus boarding/alighting → Push to parent
- Fee due reminder (7 days before, 1 day before, overdue) → Push + SMS
- Exam result published → Push + In-app
- Homework assigned → Push + In-app
- Announcement created → Push + In-app + Email (optional)

### 6. Finance Module (Record-Keeping + Future Payment Ready)

**Current Scope:**

- Fee structure definition per class per academic year
- Auto-generate fee records for enrolled students
- Manual payment recording (cash, bank transfer, mobile money)
- Invoice generation (PDF with school branding)
- Receipt generation
- Fee reports: collection summary, outstanding, class-wise, student-wise
- Fee waiver and discount management

**Future Payment Gateway Abstraction:**

```typescript
// Ready for Telebirr, CBE Birr, or international gateways
interface PaymentGateway {
  initiate(
    amount: number,
    currency: string,
    metadata: any,
  ): Promise<PaymentSession>;
  verify(transactionId: string): Promise<PaymentResult>;
  webhook(payload: any): Promise<void>;
}
```

---

## User Roles & Permissions (RBAC)

```typescript
const PERMISSIONS = {
  SUPER_ADMIN: ["*"], // Full platform access
  PARTNER_ADMIN: ["tenant:*", "license:*", "analytics:read"], // MSquare admin
  SCHOOL_ADMIN: ["school:*"], // Full school access
  PRINCIPAL: [
    "school:read",
    "student:*",
    "teacher:*",
    "exam:*",
    "report:*",
    "attendance:*",
  ],
  TEACHER: [
    "student:read",
    "attendance:write",
    "exam:write",
    "homework:*",
    "communication:write",
  ],
  ACCOUNTANT: ["finance:*", "student:read", "report:read"],
  PARENT: [
    "child:read",
    "attendance:read",
    "exam:read",
    "homework:read",
    "finance:read",
    "communication:read_write",
  ],
  STUDENT: ["self:read", "homework:read_write", "exam:read"],
  TRANSPORT_MANAGER: ["transport:*", "student:read"],
  BUS_DRIVER: ["transport:read", "bus_attendance:write"],
  RECEPTIONIST: ["student:read", "attendance:read", "visitor:*"],
};
```

---

## Implementation Phases

### Phase 1 — Foundation (Weeks 1-4)

- [ ] Project scaffolding (monorepo, Docker, CI/CD)
- [ ] Database schema + Prisma setup + RLS policies
- [ ] Auth module (JWT, roles, permissions)
- [ ] Tenant management + license system
- [ ] Partner admin dashboard (MSquare)
- [ ] Basic React admin shell (layout, routing, auth pages)

### Phase 2 — Core Academic (Weeks 5-8)

- [ ] Student management (CRUD, bulk import, documents)
- [ ] Admission workflow
- [ ] Class/Section management
- [ ] Subject & curriculum management
- [ ] Academic year management
- [ ] Teacher management
- [ ] Timetable management

### Phase 3 — Attendance & Communication (Weeks 9-11)

- [ ] RFID attendance system + WebSocket real-time feed
- [ ] Manual attendance entry
- [ ] Attendance reports
- [ ] Notification system (push + email + in-app)
- [ ] SMS provider stub (Ethio Telecom)
- [ ] Announcements & messaging

### Phase 4 — Exams & Finance (Weeks 12-14)

- [ ] Exam management + grading
- [ ] Report card generation (PDF with Ge'ez font support)
- [ ] Grade scale configuration
- [ ] Fee structure management
- [ ] Invoice & receipt generation
- [ ] Payment recording
- [ ] Financial reports

### Phase 5 — Transport & Mobile (Weeks 15-18)

- [ ] Bus route management
- [ ] GPS tracking integration
- [ ] Bus RFID attendance
- [ ] Geofence notifications
- [ ] Flutter app — parent portal (auth, dashboard, attendance, grades, transport map)
- [ ] Flutter app — push notification setup (FCM)

### Phase 6 — Localization & Polish (Weeks 19-20)

- [ ] Amharic translation (full UI + PDF reports)
- [ ] Ethiopian calendar integration
- [ ] Dashboard analytics (charts, stats per role)
- [ ] Homework module
- [ ] Data export (CSV, PDF)
- [ ] Performance optimization + load testing
- [ ] Security audit
- [ ] Deployment documentation

---

## Development Conventions

### Code Style

- **TypeScript strict mode** everywhere
- **ESLint + Prettier** with Airbnb config
- **No `any` types** — use proper typing
- Async/await only — no raw callbacks
- All API inputs validated via Zod before hitting service layer

### Git Workflow

- `main` — production
- `staging` — staging environment
- `develop` — active development
- Feature branches: `feature/MODULE-description`
- Bugfix branches: `fix/MODULE-description`
- PR required with at least 1 review

### Testing Requirements

- Unit tests for all service layer functions
- Integration tests for API endpoints (supertest)
- Minimum 70% code coverage
- Test database uses separate PostgreSQL schema

### Naming Conventions

- Files: `kebab-case` (e.g., `student.service.ts`)
- Classes: `PascalCase`
- Variables/functions: `camelCase`
- Database tables: `PascalCase` (Prisma convention)
- API routes: `kebab-case` (e.g., `/academic-year`)
- Constants/enums: `UPPER_SNAKE_CASE`

### Error Handling

- All errors extend base `AppError` class
- HTTP errors: `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`
- Business logic errors: `LicenseExpiredError`, `StudentLimitExceededError`, etc.
- Global error handler middleware catches all and returns standard error response

### Prisma + RLS Critical Rules (LEARNED THE HARD WAY)

**NEVER use `Promise.all` with Prisma operations in tenant-scoped services.**
`set_config` is session-scoped but Prisma uses a connection pool. Each operation in `Promise.all` may grab a different pool connection WITHOUT the tenant context, causing silent empty results or data leakage.

```typescript
// ❌ WRONG — each query may hit a different pool connection
const [students, count] = await Promise.all([
  prisma.student.findMany({ where: { tenantId } }),
  prisma.student.count({ where: { tenantId } }),
]);

// ✅ CORRECT — $transaction pins all queries to one connection
const [students, count] = await prisma.$transaction([
  prisma.student.findMany({ where: { tenantId } }),
  prisma.student.count({ where: { tenantId } }),
]);
```

**EVERY route that queries tenant-scoped tables MUST call setRLSContext — even auth routes.**
If a route calls `resolveTenant` but NOT `setRLSContext`, Prisma queries run on a connection with no tenant context → RLS returns 0 rows. This includes login, RFID event endpoints, and any custom auth middleware.

**Custom auth middleware (like RFID reader auth) must also set RLS context.**
The `rfidAuthMiddleware` uses `X-Reader-Secret` instead of JWT, but it still queries tenant-scoped tables. It must resolve the tenant slug to UUID and call `set_config` before any Prisma query.

**The database user MUST NOT be a superuser.**
PostgreSQL superusers bypass ALL RLS policies regardless of `FORCE ROW LEVEL SECURITY`. The app connects as `schoolsync_app` (non-superuser, NOBYPASSRLS). The `schoolsync` superuser is only for running migrations.

**Sequential operations in seed files.**
Seed scripts that use `Promise.all` with upserts will fail under RLS because parallel queries grab different pool connections. Always use sequential `for...of` loops in seed files.

---

## Environment Variables

```env
# Application
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/schoolsync
REDIS_URL=redis://localhost:6379

# Auth
JWT_ACCESS_SECRET=<random-64-char>
JWT_REFRESH_SECRET=<random-64-char>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# File Storage
S3_BUCKET=schoolsync-files
S3_REGION=me-south-1
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>
S3_ENDPOINT=<optional-for-minio>

# Notifications
FIREBASE_PROJECT_ID=<project-id>
FIREBASE_PRIVATE_KEY=<key>
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_USER=<user>
SMTP_PASS=<pass>

# License
LICENSE_ENCRYPTION_KEY=<random-32-char>

# Partner Config
PARTNER_NAME=MSquare
PARTNER_DOMAIN=msquare-edu.com
DEFAULT_LOCALE=en
DEFAULT_TIMEZONE=Africa/Addis_Ababa
DEFAULT_CALENDAR=ETHIOPIAN
```

---

## Deployment

### Docker Compose (Production)

```yaml
services:
  api:
    build: ./packages/backend
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379

  frontend:
    build: ./packages/frontend
    ports: ["80:80"]

  postgres:
    image: postgres:15-alpine
    volumes: ["pgdata:/var/lib/postgresql/data"]
    environment:
      POSTGRES_DB: schoolsync
      POSTGRES_USER: schoolsync
      POSTGRES_PASSWORD: <secure-password>

  redis:
    image: redis:7-alpine
    volumes: ["redisdata:/data"]

  nginx:
    image: nginx:alpine
    ports: ["443:443", "80:80"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs

volumes:
  pgdata:
  redisdata:
```

### Target Server

- AWS EC2 or similar VPS
- Minimum: 4 vCPU, 8GB RAM, 100GB SSD
- PostgreSQL: managed RDS recommended for production, or self-hosted
- SSL via Certbot/Let's Encrypt
- Nginx for reverse proxy + subdomain routing
- PM2 or Docker for process management

---

## Security Checklist

- [ ] All passwords hashed with bcrypt (salt rounds: 12)
- [ ] JWT tokens with short expiry (15 min access, 7 day refresh)
- [ ] Rate limiting per tenant (100 req/min default)
- [ ] Input validation on every endpoint (Zod)
- [ ] SQL injection prevention (Prisma parameterized queries + RLS)
- [ ] XSS prevention (React auto-escapes + CSP headers)
- [ ] CORS restricted to allowed origins
- [ ] File upload: type + size validation, virus scan
- [ ] RFID card numbers encrypted at rest
- [ ] Audit log for sensitive operations (login, grade changes, fee modifications)
- [ ] HTTPS enforced everywhere
- [ ] Environment variables never committed to git
- [ ] Database backups: daily automated, 30-day retention
- [ ] Database connection uses non-superuser role (schoolsync_app, NOT schoolsync)
- [ ] No Promise.all with Prisma operations in tenant-scoped services
- [ ] Every route that queries tenant data has setRLSContext in middleware chain
- [ ] RFID reader endpoints use X-Reader-Secret auth + resolve slug to tenant UUID
- [ ] Seed script uses sequential operations and switches tenant context correctly

---

## Notes for Claude Code

### Architecture Rules

1. **Start with Phase 1** — get the foundation right before building modules.
2. **RLS is critical** — every migration must include RLS policies for new tables.
3. **Test tenant isolation** — write tests that verify data doesn't leak between tenants.
4. **Ethiopian calendar** — this is non-negotiable for the Ethiopian market. Build the utility early.
5. **Amharic support** — all user-facing strings must go through i18n, never hardcode English.
6. **RFID debounce** — duplicate card taps within 5 minutes must be ignored.
7. **Notification queue** — never send notifications synchronously. Always queue via BullMQ.
8. **License checks** — enforce in middleware, not in individual controllers.
9. **PDF reports** — must support Ge'ez script. Use Noto Sans Ethiopic font.
10. **Mobile API** — same REST API serves both web and Flutter app. No separate mobile API.

### Frontend Design Rules (CRITICAL — READ BEFORE EVERY UI TASK)

11. **NEVER output AI slop** — no Inter/Roboto/Arial fonts, no purple gradients on white, no cookie-cutter card layouts. Every page must look designer-built.
12. **shadcn/ui is mandatory** — never use raw HTML form elements, never build custom components when a shadcn primitive exists. Run `pnpm dlx shadcn@latest add <component>` to add new ones.
13. **Run `/audit` (Impeccable) before every PR** — catches generic aesthetics, missing states, accessibility issues.
14. **Forms = react-hook-form + Zod + shadcn Form** — no exceptions. Every form has validation, loading states, error messages, and toast notifications.
15. **Data tables = TanStack Table + shadcn DataTable** — every list page has search, sort, paginate, bulk actions, column visibility, skeleton loading, and empty states.
16. **Design decisions persist** — use `.interface-design/system.md` and `.impeccable.md` so every new page matches the established design system. Never re-roll design choices.
17. **Test Amharic overflow** — after building any UI component, mentally check: "Would this break if the text is 40% wider?" If yes, fix the layout.
18. **Dark mode is not optional** — every component must work in both light and dark themes via shadcn CSS variables.
19. **Ethiopian names in seed data** — never use "John Doe" or "Jane Smith". Use realistic Ethiopian names: "Abebe Teshome", "Meron Hailu", "Dawit Gebremedhin".
20. **Principle-based, not pixel-perfect** — give Claude design direction and constraints ("bold, information-dense, warm color palette") not exact specifications ("use #3B82F6 with 12px rounded corners"). The aesthetic should emerge naturally.

### Skill Usage Reminders

21. **Use `/feature-dev` for new modules** — it spawns 3 agents (code-explorer, code-architect, code-reviewer) for better architecture decisions.
22. **Use `/audit` and `/polish` regularly** — Impeccable's slash commands catch issues humans miss.
23. **Use `taste-skill` dials** — set VISUAL_DENSITY=8 for admin dashboards, VISUAL_DENSITY=4 for parent portal.
24. **Check shadcn MCP before custom components** — query the shadcn registry to see if a block already exists before building from scratch.
25. **Use context7 MCP for library questions** — never guess at Prisma, TanStack, or Socket.IO APIs. Let context7 fetch the current docs.
26. **NEVER use Promise.all with Prisma** — always use prisma.$transaction([...]) for multiple tenant-scoped queries. This is the #1 source of silent bugs in this codebase.
27. **Every route needs setRLSContext** — if it touches ANY tenant-scoped table, the middleware chain must include setRLSContext. No exceptions, including auth routes and hardware device endpoints.
28. **Seed files must be sequential** — use for...of loops, not Promise.all, for all Prisma operations in seed.ts. Switch tenant context with setTenantContext() before writing data for a different tenant.
29. **Test tenant isolation after every new table** — login as Hawassa admin and verify zero records are visible. Don't assume RLS works — verify it.
30. **Report date ranges capped at 90 days** — the attendance report endpoint rejects ranges over 90 days to prevent full-table scans.
