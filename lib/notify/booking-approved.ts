import "server-only";
import { formatDateLong, formatTime } from "@/lib/time";
import { formatMoney, totalCents } from "@/lib/format";
import type { Mail } from "@/lib/notify/mailer";

/**
 * The "your appointment is confirmed" email.
 *
 * This is the message app/(public)/book/wizard.tsx has been promising the
 * client since the booking flow was built ("יישלח אליך אימייל לכשהיא תאושר").
 *
 * Styling mirrors docs/email-templates/magic-link-otp.md — same dir="rtl",
 * same Arial/Heebo stack, same palette — so the two emails a client can
 * receive look like they come from the same salon. Inline styles only: mail
 * clients strip <style> blocks.
 */

export type BookingApprovedData = {
  salonName: string;
  clientName: string;
  startsAt: string;
  timezone: string;
  currency: string;
  services: { name: string; price_cents: number }[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function bookingApproved(data: BookingApprovedData): Omit<Mail, "to"> {
  const { salonName, clientName, startsAt, timezone, currency } = data;

  // Timezone-correct via the project's own helpers rather than Date maths —
  // these are DST-correct and covered by tests/time.test.ts.
  const date = formatDateLong(startsAt, timezone);
  const time = formatTime(startsAt, timezone);
  const total = formatMoney(totalCents(data.services), currency);

  const serviceRows = data.services
    .map(
      (s) => `
      <tr>
        <td style="padding: 6px 0; font-size: 15px;">${escapeHtml(s.name)}</td>
        <td style="padding: 6px 0; font-size: 15px; text-align: left; direction: ltr;">
          ${escapeHtml(formatMoney(s.price_cents, currency))}
        </td>
      </tr>`,
    )
    .join("");

  const salon = escapeHtml(salonName);

  return {
    // Name first, then the message, rather than "התור שלך ב<שם>".
    // The salon name is owner-configurable and this one is "הסלון של אורי",
    // so a "ב" prefix would produce "בהסלון" — Hebrew contracts ב+ה to ב.
    // Sidestepping the preposition keeps the subject correct for any name.
    subject: `${salonName} — התור שלך אושר`,
    html: `<div dir="rtl" style="font-family: Arial, Heebo, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #201a18; background: #fff8f6;">
  <h1 style="font-size: 22px; margin: 0 0 16px; color: #845050;">
    ${salon}
  </h1>

  <p style="font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
    היי ${escapeHtml(clientName)}, התור שלך אושר. נתראה בקרוב!
  </p>

  <div style="background: #f7ebe8; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
    <div style="font-size: 18px; font-weight: bold; margin: 0 0 4px;">
      ${escapeHtml(date)}
    </div>
    <div style="font-size: 18px; direction: ltr; text-align: right;">
      ${escapeHtml(time)}
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin: 0 0 8px;">
    ${serviceRows}
  </table>

  <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #d6c2c1; margin: 0 0 24px;">
    <tr>
      <td style="padding: 10px 0; font-size: 16px; font-weight: bold;">סה״כ</td>
      <td style="padding: 10px 0; font-size: 16px; font-weight: bold; text-align: left; direction: ltr;">
        ${escapeHtml(total)}
      </td>
    </tr>
  </table>

  <p style="font-size: 14px; line-height: 1.6; color: #514343; margin: 0 0 8px;">
    צריך לבטל או לשנות? אפשר להיכנס לאזור האישי או פשוט להשיב לאימייל הזה.
  </p>

  <p style="font-size: 13px; color: #847373; margin: 32px 0 0; border-top: 1px solid #d6c2c1; padding-top: 16px;">
    ${salon}
  </p>
</div>`,
  };
}
