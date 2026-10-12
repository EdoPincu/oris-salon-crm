# Ori's Salon CRM

A booking and management system built for a real nail salon in Israel. Two
faces to the same app:

- **Admin** — the owner runs the business: today's schedule, calendar,
  clients with visit history, services and prices, takings, and follow-up
  reminders.
- **Public booking** — a client picks services, picks a slot, verifies their
  email with a one-time code, and requests an appointment. Requests arrive as
  **pending** for the owner to approve.

The entire interface is **Hebrew, right-to-left**.

**Stack:** Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, RLS) ·
Tailwind v4 · Vitest

---

## Things worth looking at

Most of the interesting work isn't in the UI.

### Double-booking is prevented by the database, not the app

Two clients hitting "book" on the same slot at the same instant is a race no
amount of application-level checking wins. A GiST exclusion constraint makes
it structurally impossible:

```sql
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'completed'));
```

`book_appointment()` validates availability, lead time and horizon, then
inserts — all in one transaction. A lost race raises `exclusion_violation`,
which the function catches and turns into a friendly "someone just took that
slot" message. Cancelled appointments are excluded from the constraint, so
cancelling frees the slot automatically.

### The public booking page can't read your client list

`get_available_slots()` and `book_appointment()` are `SECURITY DEFINER`, so
an anonymous visitor learns *which slots are free* and nothing about who is
in them. Row Level Security is on every table; anonymous access is limited to
the service menu, opening hours and shop settings. `payments` is owner-only,
full stop.

The RLS boundaries are asserted in tests against the live database, not
assumed from reading the policies — an empty table returns `[]` whether or
not RLS works, so every check inserts a real row first and confirms the
scoped client genuinely can't see it.

### Prices are snapshotted, not referenced

`appointment_services` copies the name, price and duration at booking time
rather than joining to `services`. Raising a price next month doesn't
retroactively rewrite last month's revenue.

Money is integer agorot (cents) everywhere — never floats.

### Timezone handling is DST-correct and tested

Working hours are wall-clock `time` values interpreted in the shop's
timezone; everything else is `timestamptz`. `zonedStartOfDay()` measures the
zone's actual offset *for the target day*, because a naive
`new Date(ymd) - offset` breaks when the offset changes mid-calculation.

Covered by tests for 23-hour (spring-forward) and 25-hour (fall-back) days,
a half-hour-offset zone as a sanity check, and week boundaries that shift
across DST transitions.

### Localization is more than translated strings

Weeks run **Sunday to Saturday** (the Israeli working week) — the calendar,
`weekRange()` and the working-hours editor all follow. Directional CSS uses
logical properties (`ms-*`, `text-start`, `border-e`) so the layout mirrors
under RTL rather than needing per-element overrides.

Two things deliberately *aren't* localized: `ymdInZone()` and
`zoneOffsetMs()` stay on machine locales, because their output is parsed as
data (slot lookups, calendar grid placement) rather than shown to anyone.
A test pins `ymdInZone()` to plain ASCII `YYYY-MM-DD` to keep it that way.

Postgres error messages are translated too — but the error *codes* aren't.
The booking wizard recovers from a lost slot by matching
`error.code === '23P01'`, never message text, so the copy can be rewritten in
any language without breaking the recovery path.

---

## Running it locally

Development never runs against the production project — so test bookings,
approvals and cancellations can never reach real salon data. There are two
dev databases to choose from; `.env.development.local` says which one.

### Development database

**Hosted dev project (`ori_salon_dev`, no Docker needed).** A second Supabase
project, ref `qqjbomzxqvbauutvhrpk`, holding only the seed data below and
test fixtures. Put its URL and keys in `.env.development.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://qqjbomzxqvbauutvhrpk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ori_salon_dev anon key>
SUPABASE_SERVICE_ROLE_KEY=<ori_salon_dev service_role key>
```

Migrations reach it the same way as production, so link a *scratch copy* of
`supabase/` to it rather than relinking this repo (which stays linked to
production for `supabase gen types --linked`):

```bash
supabase link --project-ref qqjbomzxqvbauutvhrpk   # run inside the scratch copy
supabase db push --linked --include-seed           # seed only on first setup
```

Sign-in there sends real emails through the dev project's own Gmail SMTP
and Hebrew templates — both are per-project dashboard settings, so a fresh
dev project starts with Supabase's English *link* email and needs
`docs/email-templates/magic-link-otp.md` pasted into its **Magic Link** and
**Confirm signup** templates. The dev project is not covered by the
keep-alive, so it pauses after ~7 idle days; restore it from the dashboard.
To get an owner account, sign in once at `/sign-in`, then:

```bash
node scripts/local-env.mjs npx tsx scripts/promote-owner.ts you@example.com
```

(The wrapper makes the script use the dev project; run bare, it would read
`.env.local` and promote someone in production.)

**Local stack (needs Docker).**

```bash
npm run db:start   # local Supabase (needs Docker Desktop running)
npm run db:env     # writes .env.development.local from the running stack
```

`npm run db:start` applies every migration and then `supabase/seed.sql`.
`npm run db:reset` returns to that clean state in seconds, which makes it the
right place to try a migration before it goes anywhere near production. The
local stack includes a mail catcher; OTP codes appear in its web UI (the URL is
printed by `db:start`, and `db:env` repeats it).

Either way, then:

```bash
npm install
npm run dev        # http://localhost:3000
```

The seed adds a tech, three services and Sunday–Saturday working hours —
`/book` stays closed until all three exist. Lead time is the 12-hour default,
so the earliest bookable slot is tomorrow-ish.

### The guard

`npm run dev` refuses to start unless `.env.development.local` exists **and**
points at a known dev database: `127.0.0.1`, or a host listed in
`DEV_PROJECT_HOSTS` in `scripts/local-env.mjs`. That list is an allowlist on
purpose — an unrecognised host is refused, production included. `.env.local`
holds the *production* credentials and Next.js loads it in every environment,
so a missing dev file would otherwise silently point a dev server at the
salon's real clients, appointments and takings with nothing on screen to say so.

To run against production on purpose, use `npm run dev:prod`. It goes through
`scripts/prod-env.mjs`, which pre-loads `.env.local`: a bare `next dev` would
not be production, because Next.js gives `.env.development.local` priority.

### Tests

```bash
npm run test:local   # against the dev database — safe, use this one
npm run test         # against the LIVE project — writes fixtures to real data
```

Both run the same 53 tests. `test:local` loads `.env.development.local` and
refuses to run if it is missing or not a dev database. Plain `npm run test` still points
at whatever is in `.env.local`, which is production — it cleans up after
itself, but there is no reason to take the risk now that a dev database exists.

```bash
npm run build
```

Requires a Supabase project. Copy the credentials into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server-only, never exposed
SUPABASE_DB_PASSWORD=<db password>              # for the Supabase CLI only
```

Apply the schema:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### First run

The database starts empty by design — no demo data.

1. Sign in at `/sign-in` with the owner's email. A numeric code arrives by
   email. (Length isn't assumed anywhere: Supabase's OTP length is a
   project-level setting, and this project's issues 8 digits, not the
   commonly-assumed 6.)
2. Promote that account — RLS blocks every other path, by design:
   ```bash
   npx tsx scripts/promote-owner.ts owner@example.com
   ```
3. In **Settings**, add a tech and set working hours.
4. In **Services**, add what clients can book.

`/book` stays closed until at least one service, one tech and some working
hours exist.

### Email delivery

Supabase's built-in sender is capped at 2 emails/hour project-wide, which you
will hit immediately. See [`docs/EMAIL-SETUP.md`](docs/EMAIL-SETUP.md) for
the setup — including why Resend is the wrong choice without a verified
domain (it silently refuses to deliver to anyone but the account owner, which
breaks client booking while leaving owner sign-in working).

---

## Tests

```bash
npm run test:local
```

53 tests, run against a real Postgres with their own fixtures, all cleaned up
afterwards. Prefer `test:local` — see [the guard](#the-guard); `npm run test`
runs the same suite against the live project:

- **`tests/booking.test.ts`** — slot generation: granularity, service
  durations, existing appointments, time off, lead time, booking horizon, and
  the double-booking constraint (including that cancelling frees the slot).
- **`tests/time.test.ts`** — timezone maths across DST boundaries.
- **`tests/e2e-booking.test.ts`** — a real client booking end to end, plus the
  RLS boundaries: clients can't read other clients, can't see payments, can't
  confirm their own appointment, and can't promote themselves to owner.

That last one earned its place — it caught a real privilege-escalation hole
during development. RLS has no column granularity, so the policy letting a
user edit their own profile also let them set `role = 'owner'` on themselves.
It's now blocked by a `BEFORE UPDATE` trigger.

---

## Not in this version

Inventory, SMS sending, automated reminder emails (the follow-ups page
generates copy-ready messages the owner sends by hand), staff logins (the
schema models techs, but only the owner has an account), deposits and online
payment, photo uploads, and a bilingual toggle.
