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

## Not sent by the app

Everything on this page configures **Supabase Auth's** SMTP, which sends
sign-in codes from Supabase's own servers. **The app itself sends no email.**

A "booking approved" notification was built and then removed on 2026-09-25:
Railway blocks outbound SMTP on Free, Trial and Hobby plans (ports 25, 465,
587 and 2525 — only Pro is exempt), and routing around it meant adding a
third-party sending service for one message. The booking confirmation screen
now points clients at the "התורים שלי" page to see their status instead, so
nothing promises an email that never arrives. The implementation is in git
history if it is ever wanted.

Because Supabase sends the auth mail, Railway's firewall never touches
sign-in.

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
field.** This was only spotted because a second copy of the same credential,
in code that stripped whitespace, authenticated fine while Supabase's did
not — the same password working in one place and failing in the other is
what pointed at the spaces.

**And a trap that follows from fixing a leak:** changing the Google **account**
password **revokes every App Password on the account**. That instantly breaks
Supabase Auth's SMTP and therefore *all* sign-in, owner and client alike, with
no warning. If the account password ever has to be rotated, plan to
regenerate the App Password and re-enter it in Supabase in the same sitting.

### Diagnosing it quickly

Test the credential against Gmail directly rather than guessing from
Supabase's generic 500: a throwaway script using `nodemailer`'s
`transporter.verify()` (`npx nodemailer` is not needed — install it in a
scratch directory) reports Gmail's actual refusal, which is far more specific.
Then probe the Auth endpoint to confirm the fix:

```bash
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/otp" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"someone@example.com","create_user":false}' -w '\n%{http_code}\n'
```

`200` with `{}` means Supabase accepted and sent it. Note this sends a real
code to that address.
