# 009: Soft delete via `deleted_at`

**Chosen:** Nothing is hard-deleted. Deletable entities (`users`, `events`) get a nullable
`deleted_at` timestamp column instead of a `DELETE` statement.

**Considered:** Hard `DELETE` with cascading foreign keys.

**Why:** Hard deletes create a whole class of bugs (dangling references, "record vanished mid
checkout," irrecoverable mistakes) that soft delete removes for free, and it satisfies the SRS's
audit requirement (info.pdf §7: "Organizer and administrator actions shall be auditable") without
extra code — a deleted row is still there for `audit_log` to reference.

**Who decided:** Claude + user. **Date:** 2026-09-02.
