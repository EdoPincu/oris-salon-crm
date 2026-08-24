# Working in this repo

Nail salon CRM: Next.js App Router + Supabase (Postgres, Auth, RLS).
See README.md for setup and the first-run steps.

## Conventions

- **The salon is in Israel**: `Asia/Jerusalem`, shekels, and weeks that run
  **Sunday to Saturday**. `weekRange()` returns `weekStart` (a Sunday); the
  working-hours editor lists Sunday first. Money formats with the `en-IL`
  locale, which renders ILS as a plain `₪45.00` — `he-IL` wraps it in RTL
  marks that read badly in this English, left-to-right UI.
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
