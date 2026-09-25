# Email setup — why Gmail SMTP, and how

## The problem this solves

Supabase's built-in mailer sends **2 emails per hour, project-wide** — every
sign-in, owner and client alike, shares that one pool. It's fine for
occasional testing and nothing else; the Hebrew/RTL verification pass hit it
directly and had to work around it.

## Why not Resend (the obvious fix)

Resend was the natural first choice — it's what most guides recommend, and
it's what an earlier version of this project's own docs suggested. It's
wrong for this project specifically, and worth recording so nobody re-tries
it:

**Resend will not deliver to anyone but the account owner until a custom
domain is verified.** Without domain verification, sending is restricted to
the address on the Resend account itself. Ori's Salon has no domain. Wiring
up Resend as-is would let the owner sign in fine — the owner's own inbox
*is* the allowed recipient — while silently making it **impossible for any
client to ever receive a booking code**. Online booking would look built,
pass every test that signs in as the owner, and be non-functional for
everyone else. That's a worse failure mode than the rate limit it would
replace, because it's invisible until a real client tries it.

The fix if a domain is ever bought: verify it with Resend, and this whole
document becomes unnecessary. Until then, Resend is off the table.

## The fix: Gmail SMTP

No domain required — Gmail delivers to any recipient using the salon's own
Google account.

### Settings for the Supabase dashboard

**Dashboard → Authentication → Emails → SMTP Settings:**

| Field | Value |
|---|---|
| Enable Custom SMTP | on |
| Host | `smtp.gmail.com` |
| Port | `465` (SSL) — or `587` if you'd rather use STARTTLS |
| Username | the salon's full Gmail address |
| Password | a Gmail **App Password** — not the regular Gmail password |
| Sender email | the same Gmail address |
| Sender name | `הסלון של אורי` |

Then **Authentication → Rate Limits**: enabling custom SMTP raises the
default from 2/hour to **30/hour**. Adjust that number there to whatever
real booking volume needs.

### Steps only the owner can do

An App Password is a credential — nothing above should ever be pasted into a
chat with an assistant, including this one. Generating and entering it is a
five-minute manual task:

1. Turn on **2-Step Verification** on the salon's Google account
   (myaccount.google.com/security). App Passwords don't exist without it.
2. Go to **Google Account → Security → App passwords**, create one (name it
   something like "Ori's Salon Supabase" so it's identifiable later).
3. Paste the generated password directly into the Supabase dashboard fields
   above.

### Limits worth knowing

- **500 emails per day**, rolling 24-hour window, on a free Gmail account
  (2,000/day on a paid Google Workspace account). Comfortably enough for a
  salon's booking volume; going over it suspends *outbound* sending for up
  to 24 hours (incoming mail is unaffected).
- Codes arrive **from the owner's personal Gmail address**, not a branded
  sender. That's the honest trade for not having a domain — revisit this
  the day the salon buys one.

## Hebrew templates

See `docs/email-templates/` — draft Hebrew subject/body for the Magic
Link/OTP template, ready to paste into **Authentication → Emails → Magic
Link** once SMTP is configured.

## How to verify this actually worked

Don't trust that SMTP is "configured" — prove a client can receive a code.
Trigger a sign-in from `/sign-in` (or `/book`) using an email address that
is **not** the owner's account. If the code arrives, client booking works.
If it doesn't, this setup isn't done yet, regardless of what the dashboard
shows as saved.

While that email is open, also confirm:
- The code is readable and the template renders right-to-left correctly.
- **How many digits the code actually has.** Supabase's own docs describe
  `{{ .Token }}` as a 6-digit code, but this project's live Supabase Auth
  configuration issued an **8-digit** code during testing (verified by
  generating and using a real one). The app's OTP input doesn't hardcode a
  digit count for exactly this reason — see `components/otp-form.tsx`.

---

# The app's own SMTP — a second, separate configuration

Everything above configures **Supabase Auth's** SMTP, which sends sign-in
codes. The app cannot reach that connection: it lives inside Supabase and
only ever sends auth email.

So the "booking approved" notification — the one
`app/(public)/book/wizard.tsx` promises the client on the confirmation
screen — needs its **own** SMTP credentials, set as environment variables on
the host. Today both point at the same Gmail mailbox; they are still two
independent configurations, and changing one does not change the other.

## Variables

Deliberately generic rather than Gmail-shaped, so moving to a salon mailbox,
a domain address, or a transactional provider is a config change with **no
code edit**:

| Variable | Value today | Notes |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | |
| `SMTP_PORT` | `465` | |
| `SMTP_SECURE` | `true` | Optional — defaults to `true` for port 465, `false` otherwise |
| `SMTP_USER` | the Gmail address | Same mailbox as the Supabase SMTP user |
| `SMTP_PASSWORD` | a Gmail **App Password** | The same one, or a second one generated for the app |
| `MAIL_FROM` | `הסלון של אורי <address>` | Optional — falls back to `SMTP_USER` |

Set them on Railway **via stdin**, so no secret ever appears in shell history
or in a process list:

```bash
printf '%s' 'smtp.gmail.com' | railway variable set SMTP_HOST --stdin --service nailshop
printf '%s' '<app password>'  | railway variable set SMTP_PASSWORD --stdin --service nailshop
```

## Two failure modes that cost real downtime (2026-09-25)

Both produced the same unhelpful Supabase error — `Error sending magic link
email`, HTTP 500 — and neither is guessable from it.

**1. An App Password is not the account password.** Gmail rejects the Google
account password for SMTP outright: `534-5.7.9 Application-specific password
required`. An App Password is **16 lowercase letters**, generated at
<https://myaccount.google.com/apppasswords> (the page only exists when
2-Step Verification is on). If the value you have is any other length or
contains digits or symbols, it is the wrong credential.

**2. Google shows an App Password with spaces — Supabase does not strip
them.** It is displayed as four groups (`abcd efgh ijkl mnop`) and pasting it
verbatim is the natural thing to do. Supabase passes the field to Gmail
unchanged, Gmail sees 19 characters, and authentication fails.
**Type the 16 characters with no spaces into Supabase's SMTP password
field.** `lib/notify/mailer.ts` strips whitespace itself, so the app's own
`SMTP_PASSWORD` tolerates either form — which is precisely how the two were
told apart: the same password authenticated through the app and failed
through Supabase.

**And a trap that follows from fixing a leak:** changing the Google **account**
password **revokes every App Password on the account**. That instantly breaks
Supabase Auth's SMTP and therefore *all* sign-in, owner and client alike, with
no warning. If the account password ever has to be rotated, plan to
regenerate and re-enter the App Password in both places in the same sitting.

### Diagnosing it quickly

Test the credential against Gmail directly rather than guessing from
Supabase's generic 500 — `nodemailer`'s `transporter.verify()` reports
Gmail's actual refusal. Then probe the Auth endpoint to confirm the fix:

```bash
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/otp" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"someone@example.com","create_user":false}' -w '\n%{http_code}\n'
```

`200` with `{}` means Supabase accepted and sent it. Note this sends a real
code to that address.

## Behaviour when it isn't configured

`lib/notify/mailer.ts` treats missing config as a no-op: it logs a warning
and returns `false`. It never throws. Local development, the test suite and
any environment without SMTP keep working — approving an appointment simply
doesn't email anyone. This is deliberate: the appointment is already
confirmed and committed by the time the mail is attempted, and a refused
SMTP connection must never undo that or surface as an error to the owner.

## When the email is sent

Only on a **pending → confirmed** transition of an appointment whose
`source` is `online`, and only when the client has an email on file.

- Gating on the *previous* status is what makes it idempotent — pressing
  אישור twice can't send twice, because the second press no longer sees a
  pending appointment.
- The `online` check keeps appointments the owner entered by hand from
  mailing clients unexpectedly. The promise only ever appears in the online
  booking wizard.
- `clients.email` is nullable. `book_appointment()` populates it, but only
  when it creates the client row — a client the owner had already entered by
  hand, later matched by `profile_id`, can have none. The send is skipped
  and logged.

## Moving off the personal Gmail

This is a handover prerequisite, and the variables above are why it's cheap:
create the salon mailbox, generate an App Password, update `SMTP_USER` /
`SMTP_PASSWORD` / `MAIL_FROM` on the host, and update the Supabase Auth SMTP
settings separately. No deploy, no code change — though note the app reads
these at send time, so a Railway variable change does restart the service.
