import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OwnerReturnLink } from "@/components/owner-return-link";
import { BookingWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const supabase = await createClient();

  // Booking requires a verified email, so sign in first and come straight
  // back. Same page-level pattern as app/my-appointments/page.tsx. This is
  // convenience, not the security boundary — book_appointment() rejects an
  // unauthenticated caller with SQLSTATE 28000 regardless of this redirect.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/book");

  const [{ data: settings }, { data: services }, { data: staff }, { data: me }] =
    await Promise.all([
      supabase.from("settings").select("*").single(),
      supabase
        .from("services")
        .select("id, name, description, duration_minutes, price_cents")
        .eq("active", true)
        .order("sort_order")
        .order("name"),
      supabase
        .from("staff")
        .select("id, display_name")
        .eq("active", true)
        .order("sort_order"),
      // A returning client shouldn't retype what the salon already has.
      // Empty for a first-time booker, who still supplies a name.
      supabase
        .from("clients")
        .select("full_name, phone")
        .eq("profile_id", user.id)
        .maybeSingle(),
    ]);

  const notReady = !services?.length || !staff?.length;

  if (notReady) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="mb-3 text-3xl">{settings?.display_name ?? "סלון"}</h1>
        <p className="text-on-surface-variant">
          ההזמנה המקוונת עדיין לא פתוחה. אנא צרו קשר עם הסלון ישירות.
        </p>
      </main>
    );
  }

  return (
    <>
      {/* A slim bar above the wizard rather than an overlay: the wizard owns
          a fixed bottom bar and a z-50 dialog, so anything floating here
          would collide with one of them. Renders nothing for a client. */}
      <div className="mx-auto max-w-lg px-5 pt-4 empty:hidden">
        <OwnerReturnLink />
      </div>
      <BookingWizard
        salonName={settings!.display_name}
        currency={settings!.currency}
        timezone={settings!.timezone}
        horizonDays={settings!.booking_horizon_days}
        autoConfirm={settings!.auto_confirm_online}
        services={services!}
        staff={staff!}
        defaultName={me?.full_name ?? ""}
        defaultPhone={me?.phone ?? ""}
      />
    </>
  );
}
