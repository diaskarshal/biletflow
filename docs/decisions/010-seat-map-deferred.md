# 010: Seat map — bonus only, deferred to Week 9

**Chosen:** No seat map in the Week 1-8 core plan. `venue_sections`, `rows`, `seats`, `seat_holds`
tables are deliberately excluded from the initial 10-table schema. Revisit only as a bonus
feature if the core flow is stable by Week 9.

**Considered:** Building general-admission + one predefined assigned-seating layout from Week 1,
since the SRS lists it under required features (§4.3.1).

**Why:** An interactive seat map with atomic seat holds, concurrent-purchase protection, and an
accessible SVG/Canvas UI is roughly 6 person-weeks of work the term doesn't have room for
alongside the core ticketing flow. The SRS itself lists it as a Bonus/Stretch feature
(info.pdf §8), so cutting it first (per WEEK1-PLAN.md §13.4's fallback order) doesn't touch
required MVP scope.

**Who decided:** Claude + user. **Date:** 2026-09-02.
