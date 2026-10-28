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

Set `EXPO_PUBLIC_API_URL` in `mobile/.env` to `http://<your computer's LAN IP>:8000`. The app runs on your phone, so it needs your computer's address on the Wi-Fi network to reach the API, and `localhost` on the phone means the phone itself.

To find the LAN IP (the phone and the computer must be on the same Wi-Fi):

- macOS: `ipconfig getifaddr en0`
- Windows: run `ipconfig` and take the "IPv4 Address" under your Wi-Fi adapter
- Linux: `hostname -I` and take the first address

Restart `npx expo start` after changing `.env`, then scan the QR with Expo Go on a physical phone. The camera does not work in the iOS simulator.

## Email

By default every email (account confirmation, tickets, password reset) goes to Mailhog at http://localhost:8025 and never reaches a real inbox. To send real email, create `infra/.env` with an SMTP account, for example Gmail:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=you@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=you@gmail.com
```

For Gmail, turn on 2-Step Verification and create an app password at https://myaccount.google.com/apppasswords (your normal password will not work). Then run `docker compose up -d` in `infra/`. If an email still does not arrive, `docker compose logs api` shows why. Links in emails point to http://localhost:5173, so they only open on the computer running the app.

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

Backend tests need Postgres running. They use a separate `biletflow_test` database that is created and migrated automatically, so your local data is not touched.
