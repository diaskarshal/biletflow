# 011: Translation keys from day one

**Chosen:** All customer-facing web UI strings go through translation keys from the first
component written, even though only English is populated in Week 1. Kazakh and Russian
translations get filled in around Week 11.

**Considered:** Writing plain English strings directly in JSX now, adding an i18n library and
extracting strings to keys later.

**Why:** Retrofitting i18n means touching every component a second time to replace inline
strings with key lookups — strictly more total work than starting with keys, and it's exactly
the kind of change that's cheap on day one and expensive in week 10. The SRS requires Kazakh and
Russian as the initial customer-facing locales (info.pdf §7).

**Who decided:** Claude + user. **Date:** 2026-09-02.
