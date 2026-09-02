# 004: Paid-sales activation fee

**Chosen:** 5000 KZT, one-time per event, stored as a single row in a settings table (not
hardcoded).

**Considered:** A hardcoded constant in application code; a percentage-of-sales fee instead of a
flat fee.

**Why:** The exact number is arbitrary and will never be scrutinized in an academic demo — what
matters is that a Platform Admin can change it without a deploy, per SRS §4.12 ("Configure
activation fees and platform settings"). Percentage-of-sales was rejected because it entangles
the activation-fee feature with checkout math that Week 1 hasn't built yet.

**Who decided:** Claude + user. **Date:** 2026-09-02.
