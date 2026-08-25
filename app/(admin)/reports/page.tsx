import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import {
  weekRange,
  monthRange,
  addDays,
  addMonths,
  daysInMonth,
  ymdInZone,
  zonedStartOfDay,
  formatYmd,
  isValidYmd,
  isValidYearMonth,
} from "@/lib/time";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

// Forecast only counts appointments the owner has actually approved — a
// pending request may still be declined, and a forecast that includes it
// would overstate what the week is really worth.
const FORECAST_STATUSES = ["confirmed", "completed"] as const;

type DayTotals = { ymd: string; actual: number; forecast: number };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; month?: string }>;
}) {
  const { week: weekParam, month: monthParam } = await searchParams;
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("timezone, currency")
    .single();
  const tz = settings?.timezone ?? "Asia/Jerusalem";
  const currency = settings?.currency ?? "ILS";

  // Drop malformed params rather than let them reach zonedStartOfDay, which
  // throws on an Invalid Date. Garbage in the URL falls back to "now", same
  // as the calendar page.
  const weekQ = weekParam && isValidYmd(weekParam) ? weekParam : undefined;
  const monthQ = monthParam && isValidYearMonth(monthParam) ? monthParam : undefined;

  const wk = weekRange(weekQ ? zonedStartOfDay(weekQ, tz) : new Date(), tz);
  const mo = monthRange(monthQ ? zonedStartOfDay(`${monthQ}-01`, tz) : new Date(), tz);

  const fetchStart = new Date(Math.min(wk.start.getTime(), mo.start.getTime()));
  const fetchEnd = new Date(Math.max(wk.end.getTime(), mo.end.getTime()));

  // Both figures key on the appointment's starts_at, not on when the owner
  // recorded the payment — see the "reports 1.0" plan for why. It's what
  // lets "earned so far" and "still to come" live on one axis and add up to
  // one meaningful total, and it's what keeps this page's numbers agreeing
  // with /dashboard's week tile.
  const [{ data: payments }, { data: services }] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "appointment_id, amount_cents, tip_cents, appointments!inner(starts_at, client_id, clients(full_name))",
      )
      .gte("appointments.starts_at", fetchStart.toISOString())
      .lt("appointments.starts_at", fetchEnd.toISOString()),
    supabase
      .from("appointment_services")
      .select(
        "appointment_id, name, price_cents, appointments!inner(starts_at, status, client_id, clients(full_name))",
      )
      .in("appointments.status", FORECAST_STATUSES)
      .gte("appointments.starts_at", fetchStart.toISOString())
      .lt("appointments.starts_at", fetchEnd.toISOString()),
  ]);

  const pays = payments ?? [];
  const lines = services ?? [];
  const paidAppointmentIds = new Set(pays.map((p) => p.appointment_id));

  const dayBuckets = new Map<string, { actual: number; forecast: number }>();
  const bucket = (ymd: string) => {
    let b = dayBuckets.get(ymd);
    if (!b) {
      b = { actual: 0, forecast: 0 };
      dayBuckets.set(ymd, b);
    }
    return b;
  };
  for (const p of pays) {
    const ymd = ymdInZone(new Date(p.appointments.starts_at), tz);
    bucket(ymd).actual += p.amount_cents + p.tip_cents;
  }
  for (const l of lines) {
    if (paidAppointmentIds.has(l.appointment_id)) continue; // already counted as actual
    const ymd = ymdInZone(new Date(l.appointments.starts_at), tz);
    bucket(ymd).forecast += l.price_cents;
  }

  const daysFor = (ymds: string[]): DayTotals[] =>
    ymds.map((ymd) => ({ ymd, ...(dayBuckets.get(ymd) ?? { actual: 0, forecast: 0 }) }));

  const totalsOf = (days: DayTotals[]) => ({
    actual: days.reduce((n, d) => n + d.actual, 0),
    forecast: days.reduce((n, d) => n + d.forecast, 0),
  });

  const todayYmd = ymdInZone(new Date(), tz);

  const weekYmds = Array.from({ length: 7 }, (_, i) => addDays(wk.weekStart, i));
  const weekDays = daysFor(weekYmds);
  const weekTotals = totalsOf(weekDays);

  const monthYmds = Array.from({ length: daysInMonth(mo.month) }, (_, i) =>
    addDays(`${mo.month}-01`, i),
  );
  const monthDays = daysFor(monthYmds);
  const monthTotals = totalsOf(monthDays);

  // Top clients and service mix are scoped to the selected month, not the
  // wider fetch window (which may also cover the selected week).
  const monthPays = pays.filter(
    (p) => p.appointments.starts_at >= mo.start.toISOString() && p.appointments.starts_at < mo.end.toISOString(),
  );
  const monthLines = lines.filter(
    (l) => l.appointments.starts_at >= mo.start.toISOString() && l.appointments.starts_at < mo.end.toISOString(),
  );

  const byClient = new Map<string, { name: string; cents: number }>();
  for (const p of monthPays) {
    const id = p.appointments.client_id;
    const name = p.appointments.clients?.full_name ?? "לא ידוע/ה";
    const cur = byClient.get(id) ?? { name, cents: 0 };
    byClient.set(id, { name, cents: cur.cents + p.amount_cents + p.tip_cents });
  }
  const topClients = [...byClient.values()].sort((a, b) => b.cents - a.cents).slice(0, 8);

  const byService = new Map<string, { count: number; cents: number }>();
  for (const l of monthLines) {
    const cur = byService.get(l.name) ?? { count: 0, cents: 0 };
    byService.set(l.name, { count: cur.count + 1, cents: cur.cents + l.price_cents });
  }
  const services_ = [...byService.entries()].sort((a, b) => b[1].cents - a[1].cents);

  const hrefFor = (week?: string, month?: string) => {
    const params = new URLSearchParams();
    if (week) params.set("week", week);
    if (month) params.set("month", month);
    const qs = params.toString();
    return qs ? `/reports?${qs}` : "/reports";
  };
  const weekHref = (week?: string) => hrefFor(week, monthQ);
  const monthHref = (month?: string) => hrefFor(weekQ, month);

  return (
    <div className="max-w-5xl space-y-10">
      <header>
        <h1 className="text-3xl">דוחות</h1>
      </header>

      <PeriodSection
        title="השבוע"
        subtitle={
          <>
            {formatYmd(wk.weekStart, { day: "numeric", month: "long" })}
            {" – "}
            {formatYmd(addDays(wk.weekStart, 6), { day: "numeric", month: "long", year: "numeric" })}
          </>
        }
        prevHref={weekHref(addDays(wk.weekStart, -7))}
        resetHref={weekHref(undefined)}
        nextHref={weekHref(addDays(wk.weekStart, 7))}
        resetLabel="השבוע הזה"
        totals={weekTotals}
        currency={currency}
        days={weekDays}
        todayYmd={todayYmd}
        showDayLabels
      />

      <PeriodSection
        title="החודש"
        subtitle={formatYmd(`${mo.month}-01`, { month: "long", year: "numeric" })}
        prevHref={monthHref(addMonths(mo.month, -1))}
        resetHref={monthHref(undefined)}
        nextHref={monthHref(addMonths(mo.month, 1))}
        resetLabel="החודש הזה"
        totals={monthTotals}
        currency={currency}
        days={monthDays}
        todayYmd={todayYmd}
        showDayLabels={false}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl">לקוחות מובילים</h2>
          {topClients.length === 0 ? (
            <EmptyState title="עדיין אין תקבולים החודש." />
          ) : (
            <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-lowest">
              {topClients.map((c) => (
                <li key={c.name} className="flex justify-between px-4 py-2.5 text-sm">
                  <span>{c.name}</span>
                  <span className="tabular-nums">{formatMoney(c.cents, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl">פילוח שירותים</h2>
          {services_.length === 0 ? (
            <EmptyState title="עדיין לא הוזמנו שירותים החודש." />
          ) : (
            <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-lowest">
              {services_.map(([name, v]) => (
                <li key={name} className="flex justify-between px-4 py-2.5 text-sm">
                  <span>
                    {name}
                    <span className="ms-2 text-on-surface-variant">×{v.count}</span>
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

function PeriodSection({
  title,
  subtitle,
  prevHref,
  resetHref,
  nextHref,
  resetLabel,
  totals,
  currency,
  days,
  todayYmd,
  showDayLabels,
}: {
  title: string;
  subtitle: React.ReactNode;
  prevHref: string;
  resetHref: string;
  nextHref: string;
  resetLabel: string;
  totals: { actual: number; forecast: number };
  currency: string;
  days: DayTotals[];
  todayYmd: string;
  showDayLabels: boolean;
}) {
  const peak = Math.max(...days.map((d) => d.actual + d.forecast), 1);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl">{title}</h2>
          <p className="mt-1 text-on-surface-variant">{subtitle}</p>
        </div>
        {/* prev=←, next=→: same literal-arrow convention as /calendar,
            not auto-mirrored under dir="rtl". */}
        <div className="flex gap-2">
          <Link href={prevHref} className="rounded-md border border-outline-variant px-3 py-2 text-sm">
            ← הקודם
          </Link>
          <Link href={resetHref} className="rounded-md border border-outline-variant px-3 py-2 text-sm">
            {resetLabel}
          </Link>
          <Link href={nextHref} className="rounded-md border border-outline-variant px-3 py-2 text-sm">
            הבא →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="בפועל" value={formatMoney(totals.actual, currency)} />
        <Stat label="צפי" value={formatMoney(totals.forecast, currency)} />
        <Stat label="סה״כ צפוי" value={formatMoney(totals.actual + totals.forecast, currency)} />
      </div>

      <div>
        <div className="flex h-40 items-end gap-1 rounded-lg border border-outline-variant bg-surface-lowest p-4">
          {days.map((d) => {
            const total = d.actual + d.forecast;
            const barPct = Math.max((total / peak) * 100, total > 0 ? 4 : 1);
            const actualPct = total > 0 ? (d.actual / total) * 100 : 0;
            const forecastPct = 100 - actualPct;
            const isToday = d.ymd === todayYmd;
            return (
              <div
                key={d.ymd}
                className="group relative flex h-full flex-1 flex-col justify-end"
                title={`${formatYmd(d.ymd, { day: "numeric", month: "long" })} — בפועל ${formatMoney(
                  d.actual,
                  currency,
                )}, צפי ${formatMoney(d.forecast, currency)}`}
              >
                <div
                  className={`flex w-full flex-col-reverse overflow-hidden rounded-t ${isToday ? "ring-2 ring-primary" : ""}`}
                  style={{ height: `${barPct}%` }}
                >
                  <div className="w-full bg-primary-container" style={{ height: `${actualPct}%` }} />
                  <div
                    className="w-full border-b border-dashed border-primary bg-primary-container/40"
                    style={{ height: `${forecastPct}%` }}
                  />
                </div>
                {showDayLabels && (
                  <div className="mt-1 text-center text-[10px] text-on-surface-variant">
                    {formatYmd(d.ymd, { weekday: "short" })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 flex items-center gap-4 text-sm text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary-container" /> בפועל
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-primary bg-primary-container/40" /> צפי
          </span>
        </p>
      </div>
    </section>
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
