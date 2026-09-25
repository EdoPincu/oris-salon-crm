# Working in this repo

Nail salon CRM: Next.js App Router + Supabase (Postgres, Auth, RLS).
See README.md for setup and the first-run steps.

## Conventions

- **The salon is in Israel**: `Asia/Jerusalem`, shekels, weeks that run
  **Sunday to Saturday**, and — since the Hebrew/RTL conversion — the whole
  interface is Hebrew (`lang="he" dir="rtl"` in `app/layout.tsx`). No
  bilingual toggle; strings are inline, not behind a dictionary layer.
  `weekRange()` returns `weekStart` (a Sunday); the working-hours editor
  lists Sunday first. Money formats with the `he-IL` locale — the RTL
  control marks `he-IL` wraps amounts in are correct now that the UI is
  itself RTL; it was `en-IL` while the UI was still English/LTR, where those
  marks read badly. If the UI ever goes bilingual, that reasoning flips back.
- **Two next/font gotchas from the Hebrew conversion, easy to reintroduce**:
  - The `--font-heebo` / `--font-frank-ruhl` CSS variables next/font
    generates are scoped to `<body>` (via its `className`), not `:root`.
    Referencing `var(--font-heebo)` from `app/globals.css`'s `@theme` block
    (which resolves at `:root`, an *ancestor* of body) silently resolves to
    nothing — custom properties don't inherit upward — and the whole app
    falls back to the system font stack with no error. Reference the
    literal family name (`"Heebo"`) instead; next/font's `@font-face` rules
    are injected globally under that name regardless of which element holds
    the class.
  - Supabase's OTP length is a **project-level Auth setting**, not a fixed
    6-digit protocol constant — this project's live config issues 8-digit
    codes. Don't hardcode a digit count in the OTP input's `maxLength` or in
    any copy describing it (see `components/otp-form.tsx`'s
    `MIN_CODE_LENGTH`, and `docs/email-templates/magic-link-otp.md`).
- **Money is integer cents** everywhere. Format only at the edges, via
  `lib/format.ts`. Never store or compute in floats.
- **Times are `timestamptz`.** Wall-clock rules (working hours) are `time`
  columns interpreted in the shop timezone from `public.settings`. Use the
  helpers in `lib/time.ts` rather than `Date` maths — they are DST-correct and
  covered by `tests/time.test.ts`.
- **Booking rules live in SQL**, not TypeScript. `get_available_slots()` and
  `book_appointment()` are the source of truth; a JS mirror would drift.
  Change them via a migration and extend `tests/booking.test.ts`.
- **Supabase clients**: `lib/supabase/client.ts` (browser),
  `server.ts` (RSC/actions), `admin.ts` (service role — bypasses RLS, only
  after an owner check or in scripts). Nothing else should construct one.

## Security

Every table has RLS. Two things are easy to get wrong and are tested:

- RLS has **no column granularity**. `profiles` is writable by its owner, so a
  `BEFORE UPDATE` trigger (`guard_profile_role`) is what stops a client
  setting `role = 'owner'`. Any new self-writable table needs the same
  thinking.
- Inside a `SECURITY DEFINER` function, `current_user` is the function owner,
  not the caller. Use `SECURITY INVOKER` when the function needs to know who
  is actually asking.

After changing any policy, run `npm run test` — `tests/e2e-booking.test.ts`
asserts the client-side boundaries against the live database.

## Database changes

```bash
supabase db push                                   # apply migrations
supabase gen types typescript --linked > lib/database.types.ts
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
