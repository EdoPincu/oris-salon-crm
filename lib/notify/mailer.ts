import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * App-sent email (as opposed to auth email, which Supabase sends itself).
 *
 * Two transports, tried in order. Brevo first, because **Railway blocks
 * outbound SMTP on Free, Trial and Hobby plans** — ports 25, 465, 587 and
 * 2525 are all firewalled, and only Pro and above are exempt. Every SMTP
 * send from production therefore dies at TCP connect with ETIMEDOUT, which
 * looks exactly like a misconfiguration and isn't one. Brevo's HTTPS API
 * can't be blocked that way, needs no custom domain, and is free to 300
 * messages a day.
 *
 * The SMTP path is kept for local development and for any future host that
 * permits it (or a Railway Pro upgrade) — it is not dead code, just second
 * in line.
 *
 *   BREVO_API_KEY  enables the HTTPS transport; when absent, SMTP is used
 *   MAIL_FROM      "Display Name <address>", or a bare address
 *
 *   SMTP_HOST      smtp.gmail.com
 *   SMTP_PORT      587
 *   SMTP_SECURE    true for 465, false for 587 (STARTTLS)
 *   SMTP_USER      the mailbox
 *   SMTP_PASSWORD  a Gmail App Password
 *
 * Note none of this is Supabase Auth's SMTP, which is configured separately
 * in the Supabase dashboard, sends the sign-in codes, and is sent by
 * Supabase's own servers — so it is unaffected by Railway's firewall.
 */

export type Mail = {
  to: string;
  subject: string;
  html: string;
};

/** Splits `"Display Name <a@b.com>"` into its parts; tolerates a bare address. */
function parseFrom(): { name?: string; email: string } | null {
  const raw = process.env.MAIL_FROM ?? process.env.SMTP_USER;
  if (!raw) return null;

  // `[^>]+` is greedy over inner spaces, so trim the captured address —
  // "Ori < x@y.co >" would otherwise yield "x@y.co " and Brevo would reject it.
  const match = raw.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  if (match) return { name: match[1] || undefined, email: match[2].trim() };
  return { email: raw.trim() };
}

/** Brevo's transactional endpoint. Plain HTTPS — no SDK needed for one call. */
async function sendViaBrevo(mail: Mail, apiKey: string): Promise<boolean> {
  const from = parseFrom();
  if (!from) {
    console.warn("[mail] MAIL_FROM is not set — skipped");
    return false;
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: from.email, ...(from.name && { name: from.name }) },
      to: [{ email: mail.to }],
      subject: mail.subject,
      htmlContent: mail.html,
    }),
  });

  if (!response.ok) {
    // Brevo explains refusals in the body — an unverified sender, most
    // commonly — and that detail is far more useful than the status alone.
    const detail = await response.text().catch(() => "");
    console.error(
      `[mail] Brevo rejected "${mail.subject}": ${response.status} ${detail.slice(0, 300)}`,
    );
    return false;
  }

  console.log(`[mail] sent "${mail.subject}" via Brevo`);
  return true;
}

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    host,
    port,
    // Default from the port rather than requiring the flag: 465 is implicit
    // TLS, everything else is STARTTLS. SMTP_SECURE overrides when set.
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : port === 465,
    // Google displays an App Password as four space-separated groups
    // ("abcd efgh ijkl mnop") and copying it verbatim is the obvious thing to
    // do, so strip whitespace rather than fail on it.
    auth: { user, pass: pass.replace(/\s/g, "") },
    // Force IPv4: Node prefers smtp.gmail.com's AAAA record but Railway
    // containers have no IPv6 route, so sends failed with ENETUNREACH.
    // (On Railway this no longer matters — the SMTP ports are blocked
    // outright — but it is still right for any host that allows SMTP.)
    family: 4,
  };
}

// One transporter for the process, so the pooled connection is reused.
let cached: Transporter | null = null;

function transporter(): Transporter | null {
  if (cached) return cached;
  const config = smtpConfig();
  if (!config) return null;
  cached = nodemailer.createTransport({ ...config, pool: true });
  return cached;
}

async function sendViaSmtp(mail: Mail): Promise<boolean> {
  const tx = transporter();
  if (!tx) {
    console.warn(`[mail] no transport configured — skipped: "${mail.subject}"`);
    return false;
  }

  const info = await tx.sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
  });
  console.log(
    `[mail] sent "${mail.subject}" via SMTP — accepted=${info.accepted?.length ?? 0} rejected=${info.rejected?.length ?? 0}`,
  );
  return true;
}

/**
 * Best-effort send. Returns whether the mail actually went out.
 *
 * Deliberately never throws. Every caller is doing something more important
 * than sending mail — confirming an appointment, say — and a refused
 * connection must not roll that back or surface as an error to the owner.
 * An unconfigured environment (local dev, CI, tests) is a no-op, not a crash.
 *
 * Both success and failure are logged: while debugging Railway's SMTP block,
 * a silent success and a send that never ran produced identical logs, which
 * made the real cause much harder to see than it should have been.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  try {
    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) return await sendViaBrevo(mail, brevoKey);
    return await sendViaSmtp(mail);
  } catch (error) {
    console.error(`[mail] failed to send "${mail.subject}":`, error);
    return false;
  }
}
