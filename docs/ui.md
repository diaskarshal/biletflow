# UI basics

- **Fonts:** Manrope (headings, `font-heading`), Inter (body, `font-sans`) — loaded via Google
  Fonts in `web/index.html`.
- **Color:** Bootstrap-blue `#0d6efd` (`bg-brand`/`text-brand`), dark variant `#0b5ed7`
  (`bg-brand-dark`), everything else is Tailwind's default slate/emerald/red scale.
- **Spacing:** Tailwind's default scale (4px increments). No custom spacing tokens.
- **Components:** `web/src/components/Button.tsx`, `web/src/components/Input.tsx` — thin
  wrappers over native `<button>`/`<input>` with the brand styling baked in via
  `className` composition. Extend these rather than styling raw elements inline.
