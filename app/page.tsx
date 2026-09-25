import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("display_name")
    .single();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 text-center">
      <h1 className="font-display text-4xl text-primary">
        {settings?.display_name ?? "סלון"}
      </h1>
      <p className="mt-3 text-on-surface-variant">
        קביעת התור הבא שלך בכמה הקשות בלבד.
      </p>

      <Link
        href="/book"
        className="mt-8 w-full rounded-md bg-primary px-5 py-3.5 font-medium text-on-primary"
      >
        קביעת תור
      </Link>
      <Link
        href="/my-appointments"
        className="mt-3 w-full rounded-md border border-outline-variant px-5 py-3.5"
      >
        התורים שלי
      </Link>

      {/* The staff door states its destination rather than relying on the
          sign-in page's default, so it genuinely differs from the two client
          doors above. An owner using those still lands on the client side. */}
      <Link
        href="/sign-in?next=/dashboard"
        className="mt-10 text-sm text-on-surface-variant underline"
      >
        כניסת צוות
      </Link>
    </main>
  );
}
