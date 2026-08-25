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
