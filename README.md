# Tigers café · ADE (monorepo)

- `apps/web` – Next.js frontend (mock data in `lib/data.ts`)
- `apps/api` – NestJS backend, Clean Architecture: `domain` → `application/use-cases` (one file per use case) → `infrastructure` / `presentation`

    pnpm install
    pnpm dev            # web :3000, api :4000
    docker compose up   # same, containerised

CI: `.github/workflows/ci.yml` (typecheck, test, build, docker build).
# Tigers ADE

## Local API and browser tests

Start an isolated test database on port 5434, then run the API integration tests and browser smoke test:

```sh
docker run -d --name tigers-ade-test-db \
  -e POSTGRES_USER=tigers -e POSTGRES_PASSWORD=tigers -e POSTGRES_DB=tigers_test \
  -p 127.0.0.1:5434:5432 postgres:17-alpine
DATABASE_URL=postgres://tigers:tigers@localhost:5434/tigers_test pnpm test
DATABASE_URL=postgres://tigers:tigers@localhost:5434/tigers_test pnpm --filter @tigers/web test:e2e
docker stop tigers-ade-test-db
```

Playwright needs Chromium installed once with `pnpm --filter @tigers/web exec playwright install chromium`.
