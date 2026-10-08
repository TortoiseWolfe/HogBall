# CLAUDE.md

HogBall — a ScriptHammer-based fork (Next.js 15 / React 19 / Tailwind 4 / DaisyUI / Supabase / PWA), static-exported to GitHub Pages.

Workspace conventions (Docker-first mandate, 5-file component pattern, SpecKit workflow, testing stack, deployment, code quality) live in `/home/TurtleWolfe/repos/CLAUDE.md`.

## Repo-specific facts

- **Docker service name:** `hogball` (e.g. `docker compose exec hogball pnpm ...`). **Dev port: 3000.**
- **Supabase keep-alive:** free tier auto-pauses after 7 days / inactivity. Un-pause with `docker compose exec hogball pnpm run prime` (also fixes 10–30s slow first response).
- **Component generator:** `docker compose exec hogball pnpm run generate:component` — never create components by hand (CI validates the 5-file structure).
- **Touch targets:** use `min-h-11 min-w-11` (44px) for mobile-first tap targets.

## Safety & permissions

- **Never use `sudo`.** The container runs as your UID/GID; fix permission errors with Docker, not host `sudo`. Recover a broken `.next`/`node_modules` with `docker compose down && docker compose up` (or `pnpm run docker:clean`) — do not `sudo rm` or `sudo chown` project files.
- **Git commits:** hooks only run correctly inside the container — commit with `docker compose exec hogball git commit ...`, then **push from the host** (uses your SSH keys).
- **Rebrand a fork:** run `docker compose down` **before** `./scripts/rebrand.sh` — the Docker service name changes and the old container/name will conflict otherwise.

## Static hosting constraint (GitHub Pages)

- No server-side API routes (`src/app/api/` does not run in production).
- Browser sees only `NEXT_PUBLIC_*` env vars. Any secret-dependent logic must live in Supabase (Vault + Edge Functions/triggers), not the client.
- CI/CD secrets: see `README.md`.

## Supabase migrations (CRITICAL)

- **NEVER create separate migration files.** Edit the single monolithic file: `supabase/migrations/20251006_complete_monolithic_setup.sql`. All `CREATE`s must be idempotent (`IF NOT EXISTS`), inside the existing `BEGIN;`…`COMMIT;`.
- **Execute via the Supabase Management API** (`SUPABASE_ACCESS_TOKEN` + `NEXT_PUBLIC_SUPABASE_PROJECT_REF` from `.env`) — never tell the user to paste SQL into the dashboard, never install local DB clients (`pg`/`psql`), never direct-connect from Docker (DNS fails).

## Known gotchas

- **Tailwind not loading:** do not import Leaflet CSS in `globals.css` — import it only inside the map component; restart the container after CSS changes.
- **Port 3000 in use:** `docker compose down`, then `lsof -i :3000` / `kill -9 <PID>`.
- E2E tests are local-only (not in the CI pipeline).

## Test users

- Primary: `test@example.com` / `TestPassword123!`
- Secondary (email-verification tests): set `TEST_USER_SECONDARY_EMAIL` / `TEST_USER_SECONDARY_PASSWORD` in `.env`.
