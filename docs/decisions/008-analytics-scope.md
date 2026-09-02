# 008: Analytics scope — exactly 3 charts

**Chosen:** Sales over time, sales by ticket type, check-in percentage. Nothing else for Week 1
target scope.

**Considered:** Building all the metrics implied by SRS §4.15 (capacity, gross/net revenue,
discounts, refunds, campaign attribution, checked-in vs. absent, filters by date/ticket-type).

**Why:** The SRS calls eight-plus metrics "basic," but they aren't basic to build — each is a
separate aggregation query, chart component, and filter interaction. Three charts prove the
dashboard pattern (query -> aggregate -> chart) end to end; the rest are the same pattern
repeated, which is safe to defer to Week 9 per WEEK1-PLAN.md §13.3.

**Who decided:** Claude + user. **Date:** 2026-09-02.
