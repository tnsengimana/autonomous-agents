# Docker Compose Local Dev Boot

## Overview

Make `docker compose up` start the web server, worker, and Postgres together while running pending database migrations. Ensure `.env.local` values are available inside containers for parity with local `npm` runs.

## Goals

- `docker compose up` brings up web, worker, and database in one command.
- Migrations run automatically before web/worker start.
- `.env.local` is read by containers without manual export.
- Keep the workflow dev-friendly and repeatable.

## Plan

1. **Update `docker-compose.yml` services**
   - Add `web` service for the Next.js dev server.
   - Replace the current `worker` definition to run in the same dev setup.
   - Add a `migrate` one-shot service that runs `npx drizzle-kit migrate`.
   - Add a Postgres healthcheck and use `depends_on` with `service_healthy` / `service_completed_successfully` so migrations wait for DB and web/worker wait for migrations.

2. **Ensure `.env.local` is loaded in containers**
   - Mount the repo so `.env.local` exists at runtime.
   - Use `env_file: .env.local` so Compose injects the same values.
   - Override `DATABASE_URL` in Compose for in-container networking (`postgres:5432`).

3. **Node runtime setup**
   - Use a Node base image with a shared `node_modules` volume to avoid host/OS mismatch.
   - Run `npm install` as part of service commands to ensure dependencies are present in the container volume.

## Verification

- `docker compose up` starts `postgres`, runs `migrate`, then starts `web` and `worker`.
- Web available at `http://localhost:3000`.
- Worker logs show it started successfully.
- Migrations report no pending changes or apply cleanly.
