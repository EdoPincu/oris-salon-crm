import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { formatDateLong, formatTime } from "@/lib/time";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import { CancelButton } from "./cancel-button";

export const dynamic = "force-dynamic";

export default async function MyAppointments() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/my-appointments");

  const [{ data: settings }, { data: appts }] = await Promise.all([
    supabase.from("settings").select("display_name, timezone, currency, booking_lead_hours").single(),
    supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, appointment_services(name, price_cents)")
      .order("starts_at", { ascending: false }),
  ]);

  const tz = settings?.timezone ?? "Asia/Jerusalem";
  const currency = settings?.currency ?? "ILS";
  const now = Date.now();
  const list = appts ?? [];
  const upcoming = list
    .filter((a) => new Date(a.starts_at).getTime() >= now && a.status !== "cancelled")
    .reverse();
  const past = list.filter(
    (a) => new Date(a.starts_at).getTime() < now || a.status === "cancelled",
  );

  const leadMs = (settings?.booking_lead_hours ?? 0) * 3600_000;

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="font-display text-2xl text-primary">
          {settings?.display_name ?? "Salon"}
        </h1>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-on-surface-variant underline">Sign out</button>
        </form>
      </header>

      <h2 className="mb-3 text-xl">Upcoming</h2>
      {upcoming.length === 0 ? (
        <EmptyState title="Nothing booked." hint="Ready for your next set?" />
      ) : (
        <ul className="space-y-3">
          {upcoming.map((a) => (
            <li key={a.id} className="rounded-lg border border-outline-variant bg-surface-lowest p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{formatDateLong(a.starts_at, tz)}</div>
                  <div className="text-sm text-on-surface-variant">
                    {formatTime(a.starts_at, tz)} – {formatTime(a.ends_at, tz)}
                  </div>
                </div>
                <StatusChip status={a.status} />
              </div>
              <div className="mt-2 text-sm">
                {a.appointment_services.map((s) => s.name).join(", ")}
                <span className="ml-2 text-on-surface-variant">
                  {formatMoney(
                    a.appointment_services.reduce((n, s) => n + s.price_cents, 0),
                    currency,
                  )}
                </span>
              </div>
              {new Date(a.starts_at).getTime() - now > leadMs && (
                <CancelButton id={a.id} />
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="my-6">
        <Link
          href="/book"
          className="block rounded-md bg-primary px-4 py-3 text-center font-medium text-on-primary"
        >
          Book an appointment
        </Link>
      </div>

      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-xl">Past</h2>
          <ul className="space-y-2">
            {past.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-outline-variant px-4 py-2.5 text-sm"
              >
                <span>
                  {formatDateLong(a.starts_at, tz)}
                  <span className="block text-on-surface-variant">
                    {a.appointment_services.map((s) => s.name).join(", ")}
                  </span>
                </span>
                <StatusChip status={a.status} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
