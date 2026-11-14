# Installation

Local development setup for Tigers café ADE (Next.js web + NestJS API + Postgres).

## Requirements

- Node.js (a recent LTS or newer)
- pnpm (the repo pins `pnpm@12.16.1` via `packageManager`; use Corepack: `corepack enable`)
- Docker (for Postgres)

## 1. Install dependencies

```sh
pnpm install
```

## 2. Configure the API

```sh
cp apps/api/.env.example apps/api/.env
```

`apps/api/.env` needs only:

```
DATABASE_URL=postgres://tigers:tigers@localhost:5433/tigers
```

Optional: `PORT` (default 4000), `WEB_ORIGIN` (CORS origin; default allows `http://localhost:3000` and `http://127.0.0.1:3000`),
The web app optionally reads
`NEXT_PUBLIC_API_URL` (default: same host, port 4000).

## 3. Start the database

```sh
docker compose up -d --wait db
```

This runs Postgres 17 on `127.0.0.1:5433` (local only) (user/password/db all `tigers`).

## 4. Migrate and create the owner

The database starts empty: there is no seed data. Both scripts load `apps/api/.env` themselves:

```sh
cd apps/api
pnpm db:migrate
OWNER_EMAIL=you@example.com OWNER_PASSWORD='choose-a-password' pnpm db:create-owner
cd ../..
```

This adds one branch (`BRANCH_CODE`/`BRANCH_NAME`, default `main`/`Main`) and one owner login (`OWNER_NAME` optional). Re-running changes nothing that exists. Everything else (products, staff, other users) is added in the app.

## 5. Run

Run both services from the repo root. The API loads `apps/api/.env` when it starts:

```sh
pnpm dev
```

| Service | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| Swagger docs | http://localhost:4000/docs (disabled when `NODE_ENV=production`) |

Log in with the owner you created. In Swagger, call `POST /auth/login` first; it sets the `ade_session` cookie.

## Troubleshooting

- **`EADDRINUSE :::4000`**: an old API process is still running. Find it with `ss -ltnp | grep 4000` and kill it.
- **`client password must be a string`**: `DATABASE_URL` isn't set; check `apps/api/.env`.
- **`relation "branches" already exists` on migrate**: the Postgres volume is stale. Reset it with `docker compose down -v db` (deletes all local DB data), then repeat steps 3–4.
- **`db:migrate` not found**: run it from `apps/api`, not the repo root.

## Tests

See the "Local API and browser tests" section of `README.md`.
