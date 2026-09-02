# 005: Organizer verification

**Chosen:** Organizer uploads a file (ID, business doc — never inspected/validated) and a
Platform Admin clicks Approve. `organizer_profiles.verification_status` moves
none -> pending -> approved/rejected.

**Considered:** A real KYC/KYB integration; no verification step at all.

**Why:** The SRS explicitly excludes "Production KYC/KYB or identity-verification workflows"
from the MVP (info.pdf §8/"Excluded from the Initial MVP") but still wants the *workflow* shown
(upload -> admin review -> approve/reject) for the demo and for UC2. Skipping verification
entirely would leave Paid Sales Activation (SRS §3.2/§4.5) with no gate at all.

**Who decided:** Claude + user. **Date:** 2026-09-02.
