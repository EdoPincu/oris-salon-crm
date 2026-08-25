# Magic Link / OTP template — Hebrew

Paste into **Supabase Dashboard → Authentication → Emails → Magic Link**.
This is the template `signInWithOtp()` actually sends — both the owner's
sign-in and a client's booking verification use this one template, not a
separate "OTP" template.

`{{ .Token }}` is the numeric code. See `docs/EMAIL-SETUP.md` for why the
digit count isn't assumed here — don't hardcode "6 ספרות" (6 digits) or any
other count in the wording; say "קוד" (code) without a number.

## Subject

```
קוד ההתחברות שלך לסלון של אורי
```

## Body (HTML)

```html
<div dir="rtl" style="font-family: Arial, Heebo, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #201a18; background: #fff8f6;">
  <h1 style="font-size: 22px; margin: 0 0 16px; color: #845050;">
    הסלון של אורי
  </h1>

  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
    היי! קיבלנו בקשה להתחבר עם כתובת האימייל הזו. הקוד שלך הוא:
  </p>

  <div style="font-size: 32px; font-weight: bold; letter-spacing: 0.2em; text-align: center; background: #f7ebe8; border-radius: 8px; padding: 20px; margin: 0 0 24px; direction: ltr;">
    {{ .Token }}
  </div>

  <p style="font-size: 14px; line-height: 1.6; color: #514343; margin: 0 0 8px;">
    הקוד תקף למספר דקות בלבד. אם לא ביקשת להתחבר, אפשר להתעלם מהאימייל הזה.
  </p>

  <p style="font-size: 13px; color: #847373; margin: 32px 0 0; border-top: 1px solid #d6c2c1; padding-top: 16px;">
    הסלון של אורי
  </p>
</div>
```

## Notes on the markup

- The code block itself (`{{ .Token }}`) is forced `direction: ltr` even
  though the surrounding email is `dir="rtl"` — a code is a sequence of
  digits meant to be read/typed left-to-right; letting it inherit RTL would
  risk visual reordering in some email clients.
- Colors match the app's "Serene Elegance" token values
  (`app/globals.css`) — not required for the email to function, just keeps
  the sign-in code visually consistent with the app the person is about to
  land in.
- Kept deliberately simple (inline styles, no external CSS, no images) —
  email clients strip most CSS and block external resources by default.
