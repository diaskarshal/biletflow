# BiletFlow

Event ticketing platform for Kazakhstan: event pages, free and paid tickets in KZT, QR and PDF tickets, a mobile check-in app, promo codes, support chat, analytics and admin moderation.

The API is listed in [docs/api-contract.md](docs/api-contract.md).

## Requirements

- Docker
- uv and Node.js 22.13 or newer (only for running the backend or frontend outside Docker)
- Expo Go on a phone, latest version (the app uses Expo SDK 58)

## Run locally

```bash
git clone git@github.com:diaskarshal/biletflow.git
cd biletflow
cp .env.example .env
cd infra
docker compose up -d --build
docker compose exec api uv run alembic upgrade head
docker compose exec api uv run python -m app.db.seed
```

Check it worked:

```bash
curl localhost:8000/health
```

- Web app: http://localhost:5173
- API docs: http://localhost:8000/docs
- Mailhog (all outgoing email): http://localhost:8025

Demo accounts, password `password123`:

- `admin@biletflow.kz` platform admin
- `alice@biletflow.kz` organizer
- `bob@biletflow.kz` organizer

After pulling new code:

```bash
cd infra
docker compose up -d --build -V
docker compose exec api uv run alembic upgrade head
```

## Backend dev (without Docker)

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run python -m app.db.seed
uv run uvicorn app.main:app --reload --port 8000
```

## Frontend dev

```bash
cd web
npm install
npm run dev
```

After changing the API, regenerate the typed client with the API running:

```bash
npm run generate:api
```

## Mobile app

```bash
cd mobile
cp .env.example .env
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_URL` in `mobile/.env` to your computer's LAN IP (the phone can't reach `localhost`). Scan the QR with Expo Go on a physical phone. The camera does not work in the iOS simulator.

## Tests

In Docker:

```bash
cd infra
docker compose exec api uv run pytest
docker compose exec api uv run ruff check .
docker compose exec web npm run test
docker compose exec web npm run lint
```

Without Docker:

```bash
cd backend
uv run pytest
uv run ruff check .

cd web
npm run build
npm run lint
npm run test

cd mobile
npx tsc --noEmit
```

Backend tests need Postgres running and migrated. They write test data into the local database.
