import Link from "next/link";
import { isOwner } from "@/lib/auth";

/**
 * The way back to the manager app from the client-facing pages, so an owner
 * who came in through the client door isn't stranded there.
 *
 * Renders nothing at all for anyone who isn't an owner — clients never see
 * it in the markup, not merely hidden by CSS.
 *
 * Deliberately unpositioned: both client pages own their full-page layout
 * (and /book's wizard has a fixed bottom bar plus a z-50 confirm dialog), so
 * a fixed-position link here would overlap one or the other. Each call site
 * places it in its own flow instead.
 *
 * The ← is literal and not auto-mirrored under dir="rtl" — same arrow
 * convention as the calendar's period navigation.
 */
export async function OwnerReturnLink() {
  if (!(await isOwner())) return null;

  return (
    <Link
      href="/dashboard"
      className="text-sm text-on-surface-variant underline hover:text-on-surface"
    >
      ← חזרה לניהול
    </Link>
  );
}
