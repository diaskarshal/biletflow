# 012: Repo layout — one repository, three folders

**Chosen:** A single repo (`biletflow/`) with `backend/`, `web/`, `mobile/`, `infra/`, `docs/` as
top-level folders, per WEEK1-PLAN.md §7.

**Considered:** Three separate repositories (backend, web, mobile).

**Why:** Three repos means three CI setups, three sets of branch-protection rules, and version
mismatches between the backend's OpenAPI schema and whatever commit the frontend last generated
its client from — exactly the kind of coordination overhead the shared-OpenAPI-client workflow
(WEEK1-PLAN.md §0) is meant to eliminate. One repo keeps a single PR able to touch both a backend
endpoint and its frontend consumer atomically.

**Who decided:** Claude + user. **Date:** 2026-09-02.
