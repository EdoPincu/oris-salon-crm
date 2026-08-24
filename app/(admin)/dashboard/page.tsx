import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dayRange, weekRange, formatTime, formatDateLong } from "@/lib/time";
import { formatMoney } from "@/lib/format";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import { PendingRequest } from "./pending-request";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase.from("settings").select("*").single();
  const tz = settings?.timezone ?? "Asia/Jerusalem";
  const currency = settings?.currency ?? "ILS";
  const now = new Date();
  const today = dayRange(now, tz);
  const week = weekRange(now, tz);

  const [todayRes, pendingRes, payRes, refillRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, clients(full_name), appointment_services(name)")
      .gte("starts_at", today.start.toISOString())
      .lt("starts_at", today.end.toISOString())
      .not("status", "in", "(cancelled)")
      .order("starts_at"),
    supabase
      .from("appointments")
      .select("id, starts_at, ends_at, clients(full_name, phone), appointment_services(name, price_cents)")
      .eq("status", "pending")
      .order("starts_at"),
    supabase
      .from("payments")
      .select("amount_cents, tip_cents")
      .gte("paid_at", week.start.toISOString())
      .lt("paid_at", week.end.toISOString()),
    supabase.rpc("clients_due_for_refill"),
  ]);

  const todays = todayRes.data ?? [];
  const pending = pendingRes.data ?? [];
  const revenue = (payRes.data ?? []).reduce(
    (sum, p) => sum + p.amount_cents + p.tip_cents,
    0,
  );
  const refillCount = refillRes.data?.length ?? null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Today</h1>
        <p className="mt-1 text-on-surface-variant">
          {formatDateLong(now.toISOString(), tz)}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Appointments today" value={String(todays.length)} />
        <Stat label="Revenue this week" value={formatMoney(revenue, currency)} />
        <Stat label="Pending requests" value={String(pending.length)} />
        <Stat
          label="Due for a refill"
          value={refillCount === null ? "—" : String(refillCount)}
          href="/reminders"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 text-xl">Schedule</h2>
          {todays.length === 0 ? (
            <EmptyState
              title="Nothing booked today."
              hint="Appointments you add or approve will show up here."
            />
          ) : (
            <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-lowest">
              {todays.map((a) => (
                <li key={a.id} className="flex items-center gap-4 px-4 py-3">
                  <span className="w-28 shrink-0 font-medium tabular-nums">
                    {formatTime(a.starts_at, tz)} – {formatTime(a.ends_at, tz)}
                  </span>
                  <span className="flex-1">
                    <Link href={`/appointments/${a.id}`} className="hover:underline">
                      {a.clients?.full_name ?? "Unknown client"}
                    </Link>
                    <span className="block text-sm text-on-surface-variant">
                      {a.appointment_services.map((s) => s.name).join(", ") ||
                        "No services listed"}
                    </span>
                  </span>
                  <StatusChip status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl">Booking requests</h2>
          {pending.length === 0 ? (
            <EmptyState title="No requests waiting." />
          ) : (
            <ul className="space-y-3">
              {pending.map((a) => (
                <PendingRequest
                  key={a.id}
                  id={a.id}
                  clientName={a.clients?.full_name ?? "Unknown"}
                  phone={a.clients?.phone ?? null}
                  when={`${formatDateLong(a.starts_at, tz)}, ${formatTime(a.starts_at, tz)}`}
                  services={a.appointment_services.map((s) => s.name)}
                  total={formatMoney(
                    a.appointment_services.reduce((s, x) => s + x.price_cents, 0),
                    currency,
                  )}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-lg border border-outline-variant bg-surface-lowest px-4 py-4">
      <div className="text-sm text-on-surface-variant">{label}</div>
      <div className="mt-1 font-display text-2xl">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
