# UI basics

- **Fonts:** Manrope (headings, `font-heading`), Inter (body, `font-sans`) — loaded via Google
  Fonts in `web/index.html`.
- **Color:** brand purple `#6d28d9` (`bg-brand`/`text-brand`), dark variant `#4c1d95`
  (`bg-brand-dark`), everything else is Tailwind's default slate/emerald/red scale.
- **Spacing:** Tailwind's default scale (4px increments). No custom spacing tokens.
- **Components:** `web/src/components/Button.tsx`, `web/src/components/Input.tsx` — thin
  wrappers over native `<button>`/`<input>` with the brand styling baked in via
  `className` composition. Extend these rather than styling raw elements inline.
