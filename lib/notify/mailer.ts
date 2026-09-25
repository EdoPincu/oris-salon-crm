import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * App-sent email (as opposed to auth email, which Supabase sends itself).
 *
 * Configured entirely through generic SMTP environment variables rather than
 * anything Gmail-shaped, so moving from the developer's personal Gmail to a
 * salon mailbox — or later to a domain address or a transactional provider —
 * is a config change with no code edit:
 *
 *   SMTP_HOST      smtp.gmail.com
 *   SMTP_PORT      465
 *   SMTP_SECURE    true for 465, false for 587 (STARTTLS)
 *   SMTP_USER      the mailbox
 *   SMTP_PASSWORD  a Gmail App Password today
 *   MAIL_FROM      display name + address, falls back to SMTP_USER
 *
 * Note this is a *second*, separate SMTP configuration: Supabase Auth has its
 * own under Authentication -> Emails, which sends sign-in codes and which the
 * app cannot reach. They happen to point at the same mailbox today.
 */

export type Mail = {
  to: string;
  subject: string;
  html: string;
};

function readConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
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
  };
}

// One transporter for the process. Railway runs a persistent Node server, so
// the pooled connection is reused across requests — this is exactly what was
// unreliable on serverless and is the reason this feature waited for Railway.
let cached: Transporter | null = null;

function transporter(): Transporter | null {
  if (cached) return cached;
  const config = readConfig();
  if (!config) return null;
  cached = nodemailer.createTransport({ ...config, pool: true });
  return cached;
}

/**
 * Best-effort send. Returns whether the mail actually went out.
 *
 * Deliberately never throws. Every caller is doing something more important
 * than sending mail — confirming an appointment, say — and a refused SMTP
 * connection must not roll that back or surface as an error to the owner.
 * An unconfigured environment (local dev, CI, tests) is a no-op, not a crash.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const tx = transporter();
  if (!tx) {
    console.warn(`[mail] SMTP not configured — skipped: "${mail.subject}"`);
    return false;
  }

  try {
    await tx.sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
    });
    return true;
  } catch (error) {
    console.error(`[mail] failed to send "${mail.subject}":`, error);
    return false;
  }
}
