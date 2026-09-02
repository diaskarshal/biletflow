# BiletFlow

Self-service event ticketing platform for Kazakhstan. See `docs/` for the product context
(`docs/api-contract.md`) and the reasoning behind key decisions (`docs/decisions/`).

## Windows setup (do this first if you don't have Docker or uv yet)

1. Install **Git for Windows**: https://git-scm.com/download/win — this also gives you **Git
   Bash**, which is what every command below assumes. Don't use plain PowerShell or cmd.exe;
   Git Bash behaves like the Mac/Linux terminals these instructions were written for.
2. Install **Docker Desktop for Windows**: https://www.docker.com/products/docker-desktop/.
   During install, accept the prompt to use the **WSL 2 backend** (it's the default). After
   install, launch Docker Desktop once and wait for it to say "Docker Desktop is running"
   before continuing.
3. Open **Git Bash** and clone the repo:
   ```bash
   git clone <this-repo-url> biletflow
   cd biletflow
   ```

That's all you need to *run* the project — skip to "Run it" below. `uv` and Node.js are only
needed if you're going to write backend or frontend code yourself (see "Set up to develop").

## Run it (Docker only, no uv/Node required)

```bash
cp .env.example .env

cd infra
docker compose up -d --build

docker compose exec api uv run alembic upgrade head
docker compose exec api uv run python -m app.db.seed
```

`docker compose up -d` starts Postgres, Mailhog, the API, and the web app, all inside
containers — the API container already has `uv` and Python baked in, so the migration and seed
commands above run *inside* that container, not on your machine. The migration and seed step
only need to run once; the seed script is safe to re-run and won't duplicate data.

## Verify it worked

```bash
curl localhost:8000/health
```
Expect: `{"status":"ok","db":"ok"}`.

- API interactive docs: http://localhost:8000/docs
- Web app: http://localhost:5173
- Mailhog inbox (where confirmation/verification emails land): http://localhost:8025
- Check the database directly:
  ```bash
  cd infra
  docker compose exec postgres psql -U biletflow -d biletflow -c '\dt'
  docker compose exec postgres psql -U biletflow -d biletflow -c 'select slug, status from events;'
  ```
  Expect 10 tables and, on a freshly seeded database, 3 events.

## Set up to develop (backend/frontend code changes)

Only needed if you're editing backend or frontend code and want fast local iteration instead of
rebuilding the Docker image every time.

**Windows (Git Bash):**
```bash
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
winget install OpenJS.NodeJS.LTS
```
Close and reopen Git Bash after installing so `uv` and `node` are on your `PATH`.

**Mac:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
brew install node
```

Then, from the repo root:
```bash
cd backend
uv sync
uv run alembic upgrade head
uv run python -m app.db.seed
uv run uvicorn app.main:app --reload --port 8000
```
This runs the API directly on your machine (against the Postgres started by `docker compose up`
in the previous section) with auto-reload on file changes.

## Running the mobile app

```bash
cd mobile
npm install
npx expo start
```
Scan the QR code with Expo Go on your phone. The app requests camera permission and shows a
live preview — this only works on a physical device, not the iOS simulator (it has no camera).

## Running tests

```bash
# backend
cd backend
uv run pytest
uv run ruff check .

# frontend
cd web
npm run build
npm run lint
npm run test
```

`backend/tests/test_golden_path.py` is the one worth reading — it walks the full MVP-1 flow
(create event → publish → free ticket order → check in → second scan rejected → oversell
rejected) against a real Postgres database.

## Project layout

```
backend/   FastAPI app — see app/modules/<name>/{router,service,schemas}.py per feature
web/       React app — routes in src/pages/, API client generated from the backend's OpenAPI schema
mobile/    Expo app — check-in scanner (camera scaffold only so far)
infra/     docker-compose.yml
docs/      api-contract.md, decisions/, ui.md
```

## Regenerating the frontend's API client

Whenever a backend endpoint changes, regenerate the typed client the web app imports from:

```bash
cd web
npm run generate:api
```
The backend must be running on localhost:8000 for this to work.

## Common issues

- **Docker Desktop won't start on Windows / mentions WSL**: open PowerShell as Administrator and
  run `wsl --update`, then restart Docker Desktop.
- **`docker compose up` fails to pull images / connect to the daemon**: make sure Docker Desktop
  is actually running (check the system tray icon) before retrying.
- **`docker compose exec api ...` says the service isn't running**: `docker compose ps` should
  show `api` as `Up` — if it's not, run `docker compose up -d --build` again and check
  `docker compose logs api` for the error.
- **Port already in use (5432, 8000, 5173, 8025)**: something else on your machine is bound to
  it — stop that process or change the port mapping in `infra/docker-compose.yml`.
- **Git Bash says `uv` or `node` isn't found after installing**: close and reopen Git Bash (it
  doesn't pick up a `PATH` change from an install that happened in a different window).
