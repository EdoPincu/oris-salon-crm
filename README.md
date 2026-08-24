# Ori's Salon CRM

Appointments, clients, takings and follow-ups for a nail salon — plus a public
booking page where clients verify their email and request a slot.

- **Admin** (`owner` role): dashboard, calendar, clients, services, follow-ups,
  reports, settings.
- **Public**: `/book` — pick services, pick a slot, verify email, request the
  appointment. Requests arrive as **pending** for the owner to approve.

Stack: Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, RLS) ·
Tailwind v4. Design system "Serene Elegance", generated with Google Stitch.

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

1. Open `/sign-in` and sign in with the owner's email (a 6-digit code arrives
   by email).
2. Make that person the owner:
   ```bash
   npx tsx scripts/promote-owner.ts ori@example.com
   ```
   Until this runs they are a `client` and cannot reach the admin area.
3. In **Settings**, check the timezone and currency (they default to
   `Europe/Berlin` and `EUR`), then add a tech and set working hours.
4. In **Services**, add what clients can book.

`/book` stays closed until at least one service, one tech and some working
hours exist.

### Email delivery

Supabase's built-in sender is rate-limited to a few messages an hour on the
free tier, which you will hit while testing sign-in. Point Supabase at a real
SMTP provider (Resend's free tier is 100/day) under
*Authentication → Emails → SMTP Settings* in the dashboard.

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

Money is stored as integer cents. Prices and durations are **snapshotted**
onto `appointment_services` at booking time, so changing a price never
rewrites past revenue.

## Tests

```bash
npm run test
```

35 tests, run against the live Supabase project with their own fixtures
(cleaned up afterwards):

- `tests/booking.test.ts` — slot generation: granularity, service durations,
  existing appointments, time off, lead time, horizon, and the double-booking
  constraint.
- `tests/time.test.ts` — timezone maths across DST, including 23- and 25-hour
  days and half-hour offsets.
- `tests/e2e-booking.test.ts` — a real client booking end to end, plus the RLS
  boundaries: clients cannot read other clients, cannot see payments, cannot
  confirm their own appointment, and cannot promote themselves to owner.

## Not in this version

Inventory, SMS sending, automated reminder emails, staff logins (the schema
models staff, but only the owner has an account), deposits and online payment,
photo uploads.
