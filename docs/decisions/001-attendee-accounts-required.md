# 001: Attendees must have accounts

**Chosen:** Yes, an account is required to register for or purchase a ticket. No guest checkout.

**Considered:** Guest checkout with email-only ticket delivery.

**Why:** Guest checkout adds ticket-recovery flows (lost email, resend-by-order-lookup) and
identity edge cases (who owns the ticket if the email changes hands) that don't fit Week 1's
time budget. Required accounts also give `GET /api/v1/me/orders` a trivial implementation.

**Who decided:** Claude + user. **Date:** 2026-09-02.
