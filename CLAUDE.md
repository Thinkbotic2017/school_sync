# CLAUDE.md — SchoolSync Technical Rules

## Project Identity

- **Project:** SchoolSync — White-Label School Management Platform (Generic, any country)
- **First Market:** Ethiopia (MSquare partner) — Ethiopian calendar, Amharic, Telebirr
- **Architecture:** Multi-tenant SaaS, configuration-driven (schools customize everything)
- **Repo:** https://github.com/Thinkbotic2017/school_sync

## Core Principle: Configuration Over Code

Every school is different. NOTHING is hardcoded — grading scales, class names, fee types, calendar systems, assessment weights, promotion rules, report card templates, working days, subjects, and periods per week are ALL per-tenant configuration. When building any module, ask: "Would a different school want this to work differently?" If yes, make it configurable.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express.js + TypeScript |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui |
| Mobile | Flutter (Dart) — Parent & Student Portal |
| Database | PostgreSQL 15+ (multi-tenant, RLS) |
| ORM | Prisma |
| Cache | Redis (dashboard caching, session store) |
| Auth | JWT (access 15m + refresh 7d) + bcrypt |
| Forms | React Hook Form + @hookform/resolvers + Zod |
| Data Tables | TanStack Table + shadcn DataTable |
| Data Fetching | TanStack React Query |
| State | Zustand (client state only) |
| Charts | Recharts |
| i18n | react-i18next (frontend) + custom i18n service (backend) |
| Real-time | Socket.IO |
| Task Queue | BullMQ (Redis-backed) |
| File Storage | S3-compatible (AWS S3 or MinIO) |
| CI/CD | GitHub Actions |
| Containers | Docker + Docker Compose |

---

## Prisma + RLS Critical Rules (NEVER VIOLATE)

1. **NEVER use Promise.all with Prisma** — always `prisma.$transaction([...])`. Each Promise.all query grabs a different pool connection WITHOUT tenant context.
2. **EVERY route that queries tenant-scoped tables MUST call setRLSContext** — including auth routes, RFID endpoints, and any custom middleware.
3. **Database user MUST NOT be superuser** — connect as `schoolsync_app` (NOBYPASSRLS). Superuser `schoolsync` is for migrations only.
4. **Seed files must be sequential** — `for...of` loops, not `Promise.all`. Switch tenant context with `setTenantContext()` between tenants.
5. **Every new table gets RLS** — migration must include: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + 4 policies (SELECT, INSERT, UPDATE, DELETE).

---

## Frontend Design Rules (ANTI-AI-SLOP)

1. **NEVER output generic AI aesthetics** — no Inter/Roboto/Arial, no purple gradients, no cookie-cutter cards.
2. **shadcn/ui is MANDATORY** — never raw HTML `<input>`, `<select>`, `<table>`, `<button>`.
3. **Forms = react-hook-form + Zod + shadcn Form** — every form, no exceptions.
4. **Data tables = TanStack Table + shadcn DataTable** — every list page.
5. **ALL strings through `t()`** — zero hardcoded English. Both en.json and am.json.
6. **Loading = skeleton loaders** — never spinners. Match layout shape.
7. **Dark mode REQUIRED** — every component via shadcn CSS variables.
8. **Currency formatting** — use locale-aware formatter, never hardcode "ETB".
9. **Date formatting** — respect tenant's calendar type (Gregorian or Ethiopian).
10. **Empty states** — illustration + message + CTA button on every list page.

---

## API Conventions

```
Base: /v1/{resource}
Auth: JWT Bearer token in Authorization header
Tenant: X-Tenant-ID header or subdomain

Response: { success: true, data: {...}, meta: { page, limit, total, totalPages } }
Error:    { success: false, error: { code, message, details } }

Every list endpoint: ?page, ?limit, ?search, ?sortBy, ?sortOrder
Every mutation: returns the created/updated object
Soft delete: set status/isActive, never hard delete
```

---

## Module Architecture

Every backend module follows:
```
modules/{name}/
├── {name}.routes.ts       # Express Router
├── {name}.controller.ts   # Request handlers
├── {name}.service.ts      # Business logic (receives tenantId)
├── {name}.validator.ts    # Zod schemas
├── {name}.types.ts        # TypeScript types
└── __tests__/             # Jest tests
```

Every frontend page follows:
```
pages/{name}/
├── {Name}ListPage.tsx     # DataTable + filters + search
├── {Name}FormPage.tsx     # Create/Edit form (react-hook-form + Zod)
├── {Name}DetailPage.tsx   # Detail view with tabs
└── components/            # Page-specific components
```

---

## Development Workflow

- **Git:** `main` (prod) → `develop` (active) → `feature/MODULE-desc` branches
- **Commits:** Conventional commits (`feat:`, `fix:`, `docs:`)
- **TypeScript:** Strict mode, no `any` types
- **Linting:** ESLint + Prettier
- **Testing:** Jest + React Testing Library, 70% coverage minimum

---

## Agent Pattern (4-Agent Build)

Every feature is built using 4 parallel agents:
1. **Senior Backend Engineer** — writes all backend code
2. **Senior Frontend Engineer** — writes all frontend code
3. **Senior Full Stack Reviewer** — reviews both, writes CODE_REVIEW_{phase}.md
4. **QA Engineer** — tests everything, writes QA_REPORT_{phase}.md

Rules for all agents:
- NEVER run git commands
- NEVER use Promise.all with Prisma
- Every new table gets RLS policies
- Every route gets setRLSContext
- Frontend: shadcn only, t() for all strings, react-hook-form + Zod

---

## Key Reference Documents

Read these BEFORE building any module:

| Document | What It Contains | When to Read |
|----------|-----------------|-------------|
| `docs/SCHOOL_OPERATIONS.md` | Complete school workflows, business logic, configuration specs | Before building ANY module |
| `docs/SCHEMA_REFERENCE.md` | Full Prisma schema for all tables | Before any migration |
| `docs/API_REFERENCE.md` | All endpoints, request/response formats | Before building any endpoint |
| `docs/PHASE_PLAN.md` | Phase-by-phase build plan with dependencies | Before starting any phase |
| `docs/PI_AGENT_SPEC.md` | Raspberry Pi RFID reader specification | Before RFID hardware work |

---

## Environment

```env
DATABASE_URL=postgresql://schoolsync_app:pass@localhost:5432/schoolsync_dev
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=<random-64>
JWT_REFRESH_SECRET=<random-64>
RFID_ENCRYPTION_KEY=<random-64-hex>
RFID_READER_SECRET=<random-32>
S3_BUCKET=schoolsync-files
```

## Docker (Dev)

```bash
docker compose -f docker-compose.dev.yml up -d  # PostgreSQL + Redis
cd packages/backend && pnpm dev                   # API on :3000
cd packages/frontend && pnpm dev                  # UI on :5173
```
