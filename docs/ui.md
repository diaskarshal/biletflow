# UI basics

## Web

- **Fonts:** system fonts for body and headings (`font-sans`, `font-heading`). The nav bar uses
  Unbounded (`font-nav`), loaded from `web/public/Unbounded-Regular.ttf` in `web/src/index.css`.
- **Colors:** defined once in the `@theme` block of `web/src/index.css`:
  - `brand` `#002262` dark navy, used for text, buttons and the nav bar
  - `brand-dark` `#001a4b` hover and borders on brand surfaces
  - `sky` `#f1f3f5` light grey panels and form cards
  - `on-brand` `#ffffff` text on brand surfaces
  - `accent` `#a4d0ff` links on the home page hero

  Everything else uses Tailwind's default palette: `slate` for borders and muted text, `red-700`
  for errors, and soft `emerald`/`amber`/`red`/`blue` backgrounds for status badges only.
- **Style:** plain and flat. White background, solid colors, 1px borders, no gradients, shadows or
  decorative effects.
- **Spacing:** Tailwind's default scale (4px steps), no custom tokens.
- **Components** in `web/src/components/`. Extend these instead of styling raw elements:
  - `Button` with `primary`, `secondary` and `danger` variants (`buttonClass()` for links that look
    like buttons)
  - `Input`, `Textarea`, `Select` with the brand border and focus ring
  - `Badge` / `StatusBadge` for event, ticket and order statuses
  - `Block` for a titled section with a table, `Card`, `Modal`, `Spinner`, `EmptyState` / `ErrorState`
  - `EventCard`, `EventImage` (falls back to the title when there is no cover),
    `CoverUpload`, `CalendarLinks`, `EventSettings`
- **Text:** every customer-facing string goes through `t()` from `web/src/lib/i18n.ts`, with
  Kazakh, Russian and English in `web/src/lib/messages.ts`. TypeScript fails the build when a key
  is missing in one language. The admin portal is English only.
- **Images:** cover URLs from the API can be relative (`/uploads/...`). Render them through
  `mediaUrl()` from `web/src/api/client.ts`.

## Mobile

- **Look:** white screens, blue `#2563eb` for buttons, links and selected chips, `#dddddd`
  card borders, `#555555` muted text, `#b00020` errors. Styles are local `StyleSheet`s per screen.
- **Text:** `t()` from `mobile/i18n.tsx` with the same three languages. The language switcher sits
  on the login and profile screens and the choice is stored on the device.
- **Images:** wrap cover URLs in `mediaUrl()` from `mobile/api/client.ts`, so relative upload
  paths load from the API address in `EXPO_PUBLIC_API_URL`.
