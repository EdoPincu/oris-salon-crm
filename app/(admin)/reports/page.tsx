import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { ymdInZone, zonedStartOfDay, addDays } from "@/lib/time";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("timezone, currency")
    .single();

  const tz = settings?.timezone ?? "Asia/Jerusalem";
  const currency = settings?.currency ?? "ILS";
  const today = ymdInZone(new Date(), tz);
  const since = zonedStartOfDay(addDays(today, -89), tz);

  const [{ data: payments }, { data: lines }] = await Promise.all([
    supabase
      .from("payments")
      .select("amount_cents, tip_cents, paid_at, method, appointments(client_id, clients(full_name))")
      .gte("paid_at", since.toISOString())
      .order("paid_at", { ascending: false }),
    supabase
      .from("appointment_services")
      .select("name, price_cents, appointments!inner(status, starts_at)")
      .eq("appointments.status", "completed")
      .gte("appointments.starts_at", since.toISOString()),
  ]);

  const pays = payments ?? [];

  if (pays.length === 0) {
    return (
      <div className="max-w-4xl space-y-6">
        <h1 className="text-3xl">Reports</h1>
        <EmptyState
          title="No takings recorded yet."
          hint="Complete an appointment and record its payment to start building this."
        />
      </div>
    );
  }

  const total = (rows: typeof pays) =>
    rows.reduce((n, p) => n + p.amount_cents + p.tip_cents, 0);

  const inLast = (days: number) => {
    const cutoff = zonedStartOfDay(addDays(today, -days + 1), tz).getTime();
    return pays.filter((p) => new Date(p.paid_at).getTime() >= cutoff);
  };

  // Revenue per day for the last 30 days.
  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) byDay.set(addDays(today, -i), 0);
  for (const p of pays) {
    const d = ymdInZone(new Date(p.paid_at), tz);
    if (byDay.has(d)) byDay.set(d, byDay.get(d)! + p.amount_cents + p.tip_cents);
  }
  const days = [...byDay.entries()];
  const peak = Math.max(...days.map(([, v]) => v), 1);

  // Top clients and service mix.
  const byClient = new Map<string, number>();
  for (const p of pays) {
    const name = p.appointments?.clients?.full_name ?? "Unknown";
    byClient.set(name, (byClient.get(name) ?? 0) + p.amount_cents + p.tip_cents);
  }
  const topClients = [...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const byService = new Map<string, { count: number; cents: number }>();
  for (const l of lines ?? []) {
    const cur = byService.get(l.name) ?? { count: 0, cents: 0 };
    byService.set(l.name, { count: cur.count + 1, cents: cur.cents + l.price_cents });
  }
  const services = [...byService.entries()].sort((a, b) => b[1].cents - a[1].cents);

  return (
    <div className="max-w-5xl space-y-10">
      <header>
        <h1 className="text-3xl">Reports</h1>
        <p className="mt-1 text-on-surface-variant">Last 90 days of takings.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Today" value={formatMoney(total(inLast(1)), currency)} />
        <Stat label="Last 7 days" value={formatMoney(total(inLast(7)), currency)} />
        <Stat label="Last 30 days" value={formatMoney(total(inLast(30)), currency)} />
        <Stat label="Tips (30 days)" value={formatMoney(inLast(30).reduce((n, p) => n + p.tip_cents, 0), currency)} />
      </div>

      <section>
        <h2 className="mb-3 text-xl">Daily revenue</h2>
        <div className="flex h-40 items-end gap-1 rounded-lg border border-outline-variant bg-surface-lowest p-4">
          {days.map(([day, cents]) => (
            <div key={day} className="group relative flex-1" title={`${day}: ${formatMoney(cents, currency)}`}>
              <div
                className="w-full rounded-t bg-primary-container"
                style={{ height: `${Math.max((cents / peak) * 100, cents > 0 ? 4 : 1)}%` }}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-on-surface-variant">
          Peak day: {formatMoney(peak, currency)}
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl">Top clients</h2>
          <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-lowest">
            {topClients.map(([name, cents]) => (
              <li key={name} className="flex justify-between px-4 py-2.5 text-sm">
                <span>{name}</span>
                <span className="tabular-nums">{formatMoney(cents, currency)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl">Service mix</h2>
          {services.length === 0 ? (
            <EmptyState title="No completed services yet." />
          ) : (
            <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-lowest">
              {services.map(([name, v]) => (
                <li key={name} className="flex justify-between px-4 py-2.5 text-sm">
                  <span>
                    {name}
                    <span className="ml-2 text-on-surface-variant">×{v.count}</span>
                  </span>
                  <span className="tabular-nums">{formatMoney(v.cents, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-lowest px-4 py-4">
      <div className="text-sm text-on-surface-variant">{label}</div>
      <div className="mt-1 font-display text-2xl">{value}</div>
    </div>
  );
}
