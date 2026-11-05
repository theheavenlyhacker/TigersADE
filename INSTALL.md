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
`DEV_PASSWORD` (seed password, default `tigers123`). The web app optionally reads
`NEXT_PUBLIC_API_URL` (default: same host, port 4000).

## 3. Start the database

```sh
docker compose up -d --wait db
```

This runs Postgres 17 on `127.0.0.1:5433` (local only) (user/password/db all `tigers`).

## 4. Migrate and seed

Both scripts load `apps/api/.env` themselves:

```sh
cd apps/api
pnpm db:migrate
pnpm db:seed
cd ../..
```

`db:seed` sets `ALLOW_SEED=1` and resets the seeded accounts' passwords, so only run it against a local database. It refuses to run when `NODE_ENV=production` or `ALLOW_SEED` is not `1`.

## 5. Run

The API reads `apps/api/.env` only in the shell you start it from, so run this from the repo root in a shell where `DATABASE_URL` is set (`set -a && . apps/api/.env && set +a`):

```sh
pnpm dev
```

| Service | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| Swagger docs | http://localhost:4000/docs (disabled when `NODE_ENV=production`) |

## Seeded accounts

Username is the email. Password for all: `tigers123` (or `DEV_PASSWORD`).

| Email | Role |
|---|---|
| `roy@tigerscafe.ph` | owner |
| `main@tigerscafe.ph` | manager (Main) |
| `annex@tigerscafe.ph` | manager (Annex) |
| `pacol@tigerscafe.ph` | manager (Pacol) |
| `cashier@tigerscafe.ph` | cashier (Main branch) |

In Swagger, call `POST /auth/login` first; it sets the `ade_session` cookie.

## Troubleshooting

- **`EADDRINUSE :::4000`**: an old API process is still running. Find it with `ss -ltnp | grep 4000` and kill it.
- **`client password must be a string`**: `DATABASE_URL` isn't set; check `apps/api/.env`, and export it for step 5.
- **`relation "branches" already exists` on migrate**: the Postgres volume is stale. Reset it with `docker compose down -v db` (deletes all local DB data), then repeat steps 3–4.
- **`db:migrate` not found**: run it from `apps/api`, not the repo root.

## Tests

See the "Local API and browser tests" section of `README.md`.
