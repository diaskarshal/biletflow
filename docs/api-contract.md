# API Contract v1.0

The full API surface for the final version. The frontend generates its client from the backend's
OpenAPI schema (`npm run generate:api`), so any change here goes together with a regenerated
`web/src/api/schema.d.ts`.

## Accounts

```
POST   /api/v1/auth/register              {email, password, full_name}, emails a verification link
POST   /api/v1/auth/verify-email          {token}
POST   /api/v1/auth/login                 -> {access_token, refresh_token}
POST   /api/v1/auth/refresh               {refresh_token}
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password       {email}, always 204, emails a reset link valid for 1 hour,
                                          at most once a minute per account
POST   /api/v1/auth/reset-password        {token, password}, the link stops working once used
GET    /api/v1/me
PATCH  /api/v1/me                         {full_name}
POST   /api/v1/me/password                {current_password, new_password} -> new token pair,
                                          every other session is logged out
POST   /api/v1/me/verification-email      resends the confirmation link, at most once a minute
GET    /api/v1/me/orders                  each order includes its full event

GET    /api/v1/organizer/profile          auto-creates on first call
PATCH  /api/v1/organizer/profile          display name, contact email, phone, payout account
POST   /api/v1/organizer/verification     multipart, field "document"
```

## Events

```
POST   /api/v1/events                     may include ticket_types: [...] inline
GET    /api/v1/events                     public, published, approved and not suspended, paginated
GET    /api/v1/events/{slug}              published/completed and approved: public. Otherwise owner or admin only
PATCH  /api/v1/events/{id}                owner, not while suspended. Date or venue changes email
                                          every valid ticket holder
POST   /api/v1/events/{id}/publish        owner, draft only. Submits the event for admin review (review_status pending)
POST   /api/v1/events/{id}/unpublish      owner, published and no paid or pending orders
POST   /api/v1/events/{id}/duplicate      owner, not while suspended, new draft with the same details
                                          and ticket types
POST   /api/v1/events/{id}/cancel         owner, refunds paid orders, voids pending ones, emails holders
POST   /api/v1/events/{id}/report         any user, {reason}, one open report per user and event
GET    /api/v1/events/{id}/activity       owner, organizer_staff or admin. ?date_from&date_to&action=<prefix>
GET    /api/v1/events/{id}/analytics      owner. ?date_from&date_to&ticket_type_id
GET    /api/v1/organizer/events

POST   /api/v1/events/{id}/staff          owner, {email, role: event_admin|organizer_staff}
GET    /api/v1/events/{id}/staff          owner

POST   /api/v1/events/{id}/ticket-types
GET    /api/v1/events/{id}/ticket-types
PATCH  /api/v1/ticket-types/{id}          capacity cannot go below sold + held (CAPACITY_BELOW_SOLD)

GET    /api/v1/events/{id}/activation              paid-sales checklist
POST   /api/v1/events/{id}/activation/terms
POST   /api/v1/events/{id}/activation/payment      -> {payment_id} for the activation fee
```

## Orders, payments, tickets

```
POST   /api/v1/orders                     header Idempotency-Key, optional promo_code.
                                          Free orders are paid at once. Paid orders hold seats for
                                          15 minutes and return payment_id
GET    /api/v1/orders/{id}
POST   /api/v1/orders/{id}/cancel         event owner, refunds a paid order or cancels a free one
GET    /api/v1/events/{id}/attendees      owner

GET    /api/v1/payments/{id}              payer only
POST   /api/v1/payments/{id}/simulate     payer, {outcome: success|failure|timeout}, the test provider

GET    /api/v1/tickets/{id}               buyer, attendee or event owner
GET    /api/v1/tickets/{id}/qr            PNG
GET    /api/v1/tickets/{id}/pdf           A4 printable ticket
```

## Promo codes and campaigns

```
POST   /api/v1/events/{id}/campaigns      owner, {name, code?, discount_type: percent|fixed,
                                          discount_value, valid_from?, valid_until?,
                                          max_redemptions?, ticket_type_ids?}
GET    /api/v1/events/{id}/campaigns      owner, includes link and sales per campaign
POST   /api/v1/campaigns/{id}/disable     owner
GET    /api/v1/campaigns/{id}/qr          owner, Campaign QR PNG marked "Not an entry ticket"
GET    /api/v1/events/{id}/promo          public, ?code= or ?token=, preview only
```

## Check-in

```
GET    /api/v1/checkin/events                     events the user can check in for
POST   /api/v1/checkin                            {qr_token, event_id}, validates AND checks in
POST   /api/v1/checkin/tickets/{id}               {event_id}, manual check-in from search
POST   /api/v1/checkin/tickets/{id}/undo          {event_id}
GET    /api/v1/checkin/events/{id}/summary        -> {registered, checked_in}
GET    /api/v1/checkin/events/{id}/attendees      ?q= name or email
```

All check-in endpoints need the event owner or event staff with role `event_admin`.

## Support

```
POST   /api/v1/support/cases              {kind: attendee|organizer, category, subject, message,
                                          event_id?, order_id?, ticket_id?}
GET    /api/v1/support/cases              cases I opened
GET    /api/v1/support/inbox              cases I handle, ?status=
GET    /api/v1/support/cases/{id}         requester or handler, with messages
POST   /api/v1/support/cases/{id}/messages   {body}
PATCH  /api/v1/support/cases/{id}         handler only, {status?, assignee_id?}
```

Attendee cases are handled by the event owner, organizer_staff and platform admins. Organizer
cases are handled by platform admins only.

## Platform admin

```
GET    /api/v1/admin/events/pending                  published events waiting for review
POST   /api/v1/admin/events/{id}/review              {status: approved|rejected, note?}, emails the organizer.
                                                     Editing a rejected event sends it back to pending
GET    /api/v1/admin/search?q=                       users, events, orders, payments
POST   /api/v1/admin/users/{id}/suspension           {suspended}
POST   /api/v1/admin/events/{id}/suspension          {suspended}, also closes open reports
GET    /api/v1/admin/reports                         open event reports
POST   /api/v1/admin/reports/{id}/dismiss
GET    /api/v1/admin/organizers?status=
POST   /api/v1/admin/organizers/{id}/verification    {status: approved|rejected}
GET    /api/v1/admin/settings/activation-fee
PUT    /api/v1/admin/settings/activation-fee         {amount_kzt}
GET    /api/v1/admin/activations
POST   /api/v1/admin/events/{id}/paid-sales          {suspended}
GET    /api/v1/admin/payments?status=                failed (default), refunded, expired, succeeded, pending
GET    /api/v1/admin/promos
GET    /api/v1/admin/export/{orders|payments}.csv
```

## Conventions

- **Errors** always look like `{"error": {"code": "INVENTORY_UNAVAILABLE", "message": "...", "details": {}}}`.
  The frontend switches on `code` and displays `message`. Implemented in `backend/app/core/errors.py`.
- **Auth**: `Authorization: Bearer <access_token>`. Access token 30 minutes, refresh token 30 days.
  Suspended users get `ACCOUNT_SUSPENDED` (403) on login, refresh and every authenticated call.
  Session tokens carry a fingerprint of the password hash, so a password change or reset ends
  every older session.
- **Suspended events** are hidden, cannot be edited or duplicated, and a payment that completes
  after the suspension is recorded as failed and releases its seats.
- **Pagination**: `?limit=&cursor=`.
- **Times**: every timestamp is UTC with an offset (`2026-12-01T13:00:00Z`). Show it in the
  event's `display_timezone`.
- **`POST /api/v1/checkin`** is one call that validates and checks in. A partial unique index on
  `check_in_records` prevents a double entry when two phones scan the same ticket.
- **Promo redemptions** are counted with one conditional UPDATE, so two buyers cannot both use
  the last redemption. A failed or expired payment gives the redemption back.
- **Campaign QR codes** are links to the event page. The scanner rejects them before any
  network call and the check-in endpoints never accept them.

## Known simplifications

- **Payments are simulated.** `POST /payments/{id}/simulate` stands in for the provider webhook.
- **Seat holds expire lazily.** Stale pending orders are released on the next checkout, payment
  view or My tickets load, not by a background job.
- **`POST /auth/logout` is a no-op.** JWTs are stateless; nothing is revoked server-side.
- **Any authenticated user can create events.** Verification only gates paid-sales activation.
- **Staff are added by email** and must already have an account. There is no endpoint to remove
  staff yet.
- **Email address changes are not supported.** Only the name and password can be edited.
- **The email cooldown lives in process memory.** It resets on restart and is per worker.
- **Ticket-holder update emails are sent inside the request**, one by one. Fine for demo-sized
  events; move to a background job before large events.
