# Deploy BiletFlow on Vercel

The repository root contains a Vercel Services configuration. It deploys `web/`
as a Vite frontend and `backend/` as a Python 3.12 FastAPI service in one project.
API requests and the website share an origin. React Router deep links work on refresh.
Import the repository root, not `web/`, into Vercel.

## Services and secrets

Use the Hobby plan for Vercel, the Free plan for Neon PostgreSQL, and a public
Vercel Blob store for event cover images. Keep database, Blob, and function regions
together. The initial deployment uses `iad1`.

Only event covers are stored in the public Blob store; private verification
documents must not be uploaded there. The application currently collects document
links rather than uploading documents. Cover uploads are limited to 4 MiB to leave
room for multipart overhead below Vercel's 4.5 MB function payload limit.

Copy `.env.vercel.example` to the ignored `.env.vercel.local` and set:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Hosted PostgreSQL URL with TLS, preferably the pooled endpoint |
| `JWT_SECRET` | Random secret of at least 32 characters |
| `FRONTEND_URL` | Stable production HTTPS URL, without a trailing slash |
| `UPLOADS_BACKEND` | `vercel_blob` |
| `BLOB_READ_WRITE_TOKEN` | Token from the connected public Blob store |
| `DEMO_PASSWORD` | Password of at least 8 characters, matching the app's password policy, for demo seeding |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `EMAIL_FROM` | Real sender settings when available |

Vercel supplies `VERCEL` and `VERCEL_ENV` automatically. The example file also sets
them so local deployment commands validate production settings. Do not manually
override these system variables in Vercel. Do not prefix backend secrets with
`VITE_`; Vite exposes those variables to browsers. Leave `VITE_API_URL` unset for
this configuration.

Use separate database and Blob resources for Preview. Until those exist, provision
the resources and secrets for Production only. Production validation intentionally
rejects unconfigured deployments. Never run the test suite against a production
database: its test setup creates a database with a `_test` suffix.

## Prepare the database

Run from `backend/` after selecting the correct production secrets:

```sh
uv sync --frozen
uv run python -m app.deploy --env-file ../.env.vercel.local migrate
uv run python -m app.deploy --env-file ../.env.vercel.local check
uv run python -m app.deploy --env-file ../.env.vercel.local seed
```

The backend build runs `app.deploy prepare`, which applies pending migrations
before the deployment becomes ready. Migrations never run on cold starts. If a
local database connection is unavailable, this build step initializes the schema
inside Vercel. For the initial demo deployment only, set `DEMO_PASSWORD` as a
Production secret and deploy with `--build-env SEED_DEMO=1`. Later deployments omit
that flag. The seed creates the existing demo events and accounts and uploads
their covers to Blob. New demo accounts use `DEMO_PASSWORD`; reseeding does not
reset existing passwords. The demo account emails are `admin@biletflow.kz`,
`aru@biletflow.kz`, and `arman@biletflow.kz`.

## Deploy

From the repository root:

```sh
npx vercel@latest login
npx vercel@latest link
npx vercel@latest deploy --prod
```

Set the Production environment variables in Vercel before deploying. The local
`.env.vercel.local` file is for manual setup commands and is excluded from uploads;
Vercel does not import it automatically. The CLI may create a separate `.env.local`
when linking the project. Keep both files ignored.

The project can be deployed directly with the CLI without GitHub integration.
For automatic Git deployments, connect the GitHub account/repository in Vercel,
then merge the reviewed deployment branch into the configured production branch.
Until Preview has isolated resources, verify production candidates locally and
deploy explicitly with the CLI.

## Verify and maintain

Check the home page, refresh `/login`, and confirm `/health` returns HTTP 200 with
`{"status":"ok","db":"ok"}`. Check `/api/v1/events` returns JSON, sign in with a
demo account, and verify a newly uploaded cover remains accessible after a redeploy.
Use `/docs` for the API documentation. The Expo app can use the same HTTPS origin
as `EXPO_PUBLIC_API_URL`.

Email delivery is disabled with `SMTP_ENABLED=false` until a real sender is
configured. Set it to `true` when enabling real email. Mailhog and
`localhost:1025` are only local test settings. With a real sender, confirm that
verification/reset links use `FRONTEND_URL`, and test a ticket email with its PDF.
Payments in this project are simulated; deploying it does not connect a payment
processor.

Keep the demo password private because the admin demo account can moderate data.
Before opening real sales, replace demo access with controlled accounts and
configure email and a payment provider. Keep database and Blob backups separately;
rolling back a Vercel deployment does not roll back its database or uploads.

Provider references: [Vercel Services](https://vercel.com/docs/services),
[service routing](https://vercel.com/docs/services/routing),
[Vite deep links](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas),
[Blob Python SDK](https://vercel.com/docs/vercel-blob/python-sdk-reference), and
[function limits](https://vercel.com/docs/functions/limitations).
