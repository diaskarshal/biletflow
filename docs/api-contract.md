# API Contract v0.1

Twenty endpoints. This defines the first MVP surface (MVP-0/MVP-1, see WEEK1-PLAN.md #13). No
more endpoints get added without updating this file first — the frontend generates its client
from the backend's OpenAPI schema, so this is the thing both halves agree on before writing code
in parallel.

```
POST   /api/v1/auth/register            {email, password, full_name}
POST   /api/v1/auth/verify-email        {token}
POST   /api/v1/auth/login               -> {access_token, refresh_token}
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/me

POST   /api/v1/events                   organizer only
GET    /api/v1/events                   public, published only, paginated
GET    /api/v1/events/{slug}            public
PATCH  /api/v1/events/{id}
POST   /api/v1/events/{id}/publish
POST   /api/v1/events/{id}/cancel
GET    /api/v1/organizer/events

POST   /api/v1/events/{id}/ticket-types
GET    /api/v1/events/{id}/ticket-types
PATCH  /api/v1/ticket-types/{id}

POST   /api/v1/orders                   header: Idempotency-Key
GET    /api/v1/orders/{id}
GET    /api/v1/me/orders
GET    /api/v1/events/{id}/attendees    organizer only

GET    /api/v1/tickets/{id}
GET    /api/v1/tickets/{id}/pdf
POST   /api/v1/checkin                  {qr_token, event_id}  -> validates AND checks in, one call
```

## Conventions

- **Errors** always look like `{"error": {"code": "INVENTORY_UNAVAILABLE", "message": "...", "details": {}}}`.
  The frontend switches on `code` and displays `message`. Never make the frontend parse English.
  Implemented in `backend/app/core/errors.py`.
- **Auth**: `Authorization: Bearer <access_token>`. Access token 30 minutes, refresh token 30 days.
- **Pagination**: `?limit=&cursor=`.
- **`POST /api/v1/checkin`** is ONE call that validates and checks in. If it were split into
  "check status" then "check in", two phones could both read "valid" before either one writes —
  the DB-level partial unique index on `check_in_records` is what actually prevents the double
  entry; the single-call contract is what keeps the race window from opening in the first place.

## Status

All 20 endpoints above are implemented, plus `/health`, covering the MVP-1 golden path
(WEEK1-PLAN.md #13): register/login, create+publish a free event, register for it, get a
QR-coded ticket, get checked in, second scan refused. Deviations from the contract as written:

- **`GET /tickets/{id}/pdf` → `GET /tickets/{id}/qr`.** Returns the raw QR PNG instead of a
  print-optimized PDF. Full PDF rendering (WeasyPrint/ReportLab, per WEEK1-PLAN.md #4.3 spike) is
  Week 7 scope; this is the minimum needed for the mobile app to have something scannable now.
- **Paid ticket types are rejected at checkout** with `PAID_CHECKOUT_NOT_IMPLEMENTED` (501). The
  simulated payment provider (`docs/decisions/003`) isn't built yet, so `POST /orders` only
  accepts `price_kzt: 0` ticket types for now.
- **`POST /checkin` only authorizes the event's organizer**, not arbitrary `event_staff`. There's
  no staff-assignment endpoint in this contract yet, so `event_staff` rows are never populated —
  add the lookup once that endpoint exists.
- **`POST /auth/logout` is a no-op.** JWTs are stateless; nothing is revoked server-side. Add a
  revocation list if forced early logout is ever needed.
- **Any authenticated user can create events.** `organizer_profiles` is auto-provisioned on first
  `POST /events` — verification (`docs/decisions/005`) only gates *paid* sales activation, not
  event creation, per SRS §3.1/§4.2.
