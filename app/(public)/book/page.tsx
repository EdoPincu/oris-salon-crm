import { createClient } from "@/lib/supabase/server";
import { BookingWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const supabase = await createClient();

  const [{ data: settings }, { data: services }, { data: staff }] =
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
    ]);

  const notReady = !services?.length || !staff?.length;

  if (notReady) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="mb-3 text-3xl">{settings?.display_name ?? "Salon"}</h1>
        <p className="text-on-surface-variant">
          Online booking isn&apos;t open yet. Please get in touch with the salon
          directly.
        </p>
      </main>
    );
  }

  return (
    <BookingWizard
      salonName={settings!.display_name}
      currency={settings!.currency}
      timezone={settings!.timezone}
      horizonDays={settings!.booking_horizon_days}
      autoConfirm={settings!.auto_confirm_online}
      services={services!}
      staff={staff!}
    />
  );
}
