# BiletFlow

Event ticketing platform for Kazakhstan.

## Requirements

- Docker
- uv (for backend dev)
- Node.js (for frontend dev)

## Run locally

```bash
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

- API docs: http://localhost:8000/docs
- Web app: http://localhost:5173
- Mailhog: http://localhost:8025

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

## Mobile app

```bash
cd mobile
npm install
npx expo start
```

Scan the QR with Expo Go on a physical phone. The camera does not work in the iOS simulator.

## Tests

```bash
cd backend
uv run pytest
uv run ruff check .

cd web
npm run build
npm run lint
npm run test
```
