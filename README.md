# Ori's Salon CRM

Appointments, clients, takings and follow-ups for a nail salon — plus a public
booking page where clients verify their email and request a slot.

- **Admin** (`owner` role): dashboard, calendar, clients, services, follow-ups,
  reports, settings.
- **Public**: `/book` — pick services, pick a slot, verify email, request the
  appointment. Requests arrive as **pending** for the owner to approve.

Stack: Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, RLS) ·
Tailwind v4. Interface is Hebrew, right-to-left (`lang="he" dir="rtl"`).
Design system "Serene Elegance", generated with Google Stitch — typefaces
are Frank Ruhl Libre + Heebo (Hebrew-capable; the design's originals,
Libre Caslon Text + DM Sans, ship no Hebrew glyphs at all).

## Setup

```bash
npm install
npm run dev            # http://localhost:3000
```

`.env.local` holds the Supabase URL, anon key, service-role key and database
password. It is gitignored and must never be committed.

Supabase project: `oris-salon-crm` (ref `xnqrnsailsulchsymfgt`, eu-central-1).

## First run

The database starts empty on purpose — no demo data.

1. Open `/sign-in` and sign in with the owner's email (a numeric code
   arrives by email — Supabase's configured length for this project is 8
   digits, not the commonly-assumed 6; the app doesn't hardcode a count).
2. Make that person the owner:
   ```bash
   npx tsx scripts/promote-owner.ts ori@example.com
   ```
   Until this runs they are a `client` and cannot reach the admin area.
3. In **Settings**, add a tech and set working hours. Timezone and currency
   are already `Asia/Jerusalem` and `ILS`.
4. In **Services**, add what clients can book.

`/book` stays closed until at least one service, one tech and some working
hours exist.

### Email delivery

Supabase's built-in sender is rate-limited to 2 emails/hour project-wide,
which you will hit immediately while testing sign-in. **Use Gmail SMTP, not
Resend** — Resend refuses to deliver to anyone but the account owner until a
custom domain is verified, and this salon has none; wiring it up as-is would
let the owner sign in while silently breaking sign-in for every client. Full
setup steps, exact dashboard values, and the Hebrew email template are in
[`docs/EMAIL-SETUP.md`](docs/EMAIL-SETUP.md).

## Database

Migrations live in `supabase/migrations/` and apply with:

```bash
supabase db push
```

Two rules are enforced by Postgres rather than application code, because
neither survives a race otherwise:

- **`appointments_no_overlap`** — a GiST exclusion constraint. Two clients
  cannot hold the same tech at the same time, whatever the app does.
- **`book_appointment()`** — validates lead time, horizon and availability,
  then inserts, all in one transaction.

Availability is computed by `get_available_slots()`. Both functions are
`SECURITY DEFINER`, so the public booking page never needs read access to
`appointments` or `clients` — a visitor learns which slots are free and
nothing about who is in them.

Weeks run **Sunday to Saturday** throughout — the calendar, the working-hours
editor and `weekRange()` in `lib/time.ts`.

Money is stored as integer agorot (cents). Prices and durations are **snapshotted**
onto `appointment_services` at booking time, so changing a price never
rewrites past revenue.

## Tests

```bash
npm run test
```

40 tests, run against the live Supabase project with their own fixtures
(cleaned up afterwards):

- `tests/booking.test.ts` — slot generation: granularity, service durations,
  existing appointments, time off, lead time, horizon, and the double-booking
  constraint.
- `tests/time.test.ts` — timezone maths across DST, including 23- and 25-hour
  days and half-hour offsets; plus two guards from the Hebrew conversion —
  `ymdInZone()` still returns plain ASCII digits (never localized, since its
  output is parsed as data), and `formatDateLong()` does render Hebrew.
- `tests/e2e-booking.test.ts` — a real client booking end to end, plus the RLS
  boundaries: clients cannot read other clients, cannot see payments, cannot
  confirm their own appointment, and cannot promote themselves to owner.

## Not in this version

Inventory, SMS sending, automated reminder emails, staff logins (the schema
models staff, but only the owner has an account), deposits and online payment,
photo uploads.
