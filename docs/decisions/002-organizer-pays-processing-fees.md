# 002: Organizer pays processing fees

**Chosen:** The organizer absorbs payment-processing fees. The price shown to the attendee is
the price they pay — no fee line added at checkout.

**Considered:** Passing the processing fee to the attendee as a separate checkout line item.

**Why:** One less thing to explain during the demo, and it matches how most Kazakhstan ticketing
platforms currently price. `orders.fee_kzt` still exists so the fee is recorded and visible on
the organizer's analytics dashboard, it's just not charged to the attendee on top of `total_kzt`.

**Who decided:** Claude + user. **Date:** 2026-09-02.
