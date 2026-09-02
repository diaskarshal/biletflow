# 003: Payment approach — internal simulation

**Chosen:** A self-built fake payment provider with SUCCESS / FAILURE / TIMEOUT buttons, plus a
webhook callback back into the API, standing in for a real payment processor.

**Considered:** Integrating a real payment provider's sandbox (e.g. a Kazakhstan PSP's test
mode).

**Why:** Real sandbox credentials are a schedule and access risk (approval delays, sandbox
downtime, changing test-card behavior) with no payoff for an academic MVP — the SRS explicitly
allows "a clearly labelled internal simulation" (info.pdf §3.2/§4.6) and requires that
demonstration payment records never be presented as real financial transactions.

**Who decided:** Claude + user. **Date:** 2026-09-02.
