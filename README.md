# SchoolSync

White-label School Management Platform for Ethiopia, built by Infosware Solutions for MSquare.

## Stack

- **Backend**: Node.js + Express.js + TypeScript + Prisma + PostgreSQL
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui
- **Mobile**: Flutter (Phase 5)
- **Infrastructure**: Docker + PostgreSQL 15 + Redis 7 + Nginx

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- pnpm 8+
- Docker + Docker Compose

### 1. Start infrastructure
```bash
docker compose -f docker-compose.dev.yml up -d
```

### 2. Backend setup
```bash
cd packages/backend
cp .env.example .env
pnpm install
pnpm prisma migrate dev
pnpm dev
```

### 3. Frontend setup
```bash
cd packages/frontend
cp .env.example .env
pnpm install
pnpm dev
```

## Development Ports

| Service    | Port  |
|------------|-------|
| Backend    | 3000  |
| Frontend   | 5173  |
| PostgreSQL | 5432  |
| Redis      | 6379  |

## Implementation Phases

- **Phase 1** (Weeks 1-4): Foundation — Auth, Tenant, License
- **Phase 2** (Weeks 5-8): Core Academic — Students, Classes, Subjects
- **Phase 3** (Weeks 9-11): Attendance & Communication
- **Phase 4** (Weeks 12-14): Exams & Finance
- **Phase 5** (Weeks 15-18): Transport & Mobile
- **Phase 6** (Weeks 19-20): Localization & Polish
