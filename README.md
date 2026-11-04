# Tigers café · ADE (monorepo)

- `apps/web` – Next.js frontend (mock data in `lib/data.ts`)
- `apps/api` – NestJS backend, Clean Architecture: `domain` → `application/use-cases` (one file per use case) → `infrastructure` / `presentation`

    pnpm install
    pnpm dev            # web :3000, api :4000
    docker compose up   # same, containerised

CI: `.github/workflows/ci.yml` (typecheck, test, build, docker build).
