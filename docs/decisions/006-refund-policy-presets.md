# 006: Refund policy — fixed presets

**Chosen:** Organizers pick from three fixed refund-policy presets in a dropdown (e.g. "Full
refund up to 48h before event", "No refunds", "Full refund any time before event"), not free
text.

**Considered:** A free-text refund policy field the organizer writes themselves.

**Why:** An enum is testable — a test can assert "refund allowed" / "refund denied" for a known
preset. Free text can't be enforced by code at all; it would just be a label with no effect on
`POST` refund behavior, which fails SRS §4.9 ("Organizers shall be able to define a refund
policy" implies the platform enforces it, not just displays it).

**Who decided:** Claude + user. **Date:** 2026-09-02.
