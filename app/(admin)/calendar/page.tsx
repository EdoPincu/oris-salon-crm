import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { weekRange, zonedStartOfDay, addDays, ymdInZone, formatTime } from "@/lib/time";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

const OPEN_HOUR = 8;
const CLOSE_HOUR = 20;
const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-primary-fixed text-on-primary-container border-primary",
  confirmed: "bg-secondary-container text-on-secondary-container border-secondary",
  completed: "bg-surface-highest text-on-surface-variant border-outline-variant",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: weekParam } = await searchParams;
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("timezone")
    .single();
  const tz = settings?.timezone ?? "UTC";

  const anchor = weekParam
    ? zonedStartOfDay(weekParam, tz)
    : new Date();
  const week = weekRange(anchor, tz);
  const dayYmds = Array.from({ length: 7 }, (_, i) => addDays(week.monday, i));

  const { data: appts } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, clients(full_name), appointment_services(name)")
    .gte("starts_at", week.start.toISOString())
    .lt("starts_at", week.end.toISOString())
    .not("status", "in", "(cancelled,no_show)")
    .order("starts_at");

  const list = appts ?? [];
  const prev = addDays(week.monday, -7);
  const next = addDays(week.monday, 7);
  const todayYmd = ymdInZone(new Date(), tz);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Calendar</h1>
          <p className="mt-1 text-on-surface-variant">
            {new Date(`${week.monday}T12:00:00Z`).toLocaleDateString("en-GB", {
              day: "numeric", month: "long", timeZone: "UTC",
            })}{" "}
            –{" "}
            {new Date(`${addDays(week.monday, 6)}T12:00:00Z`).toLocaleDateString("en-GB", {
              day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/calendar?week=${prev}`} className="rounded-md border border-outline-variant px-3 py-2 text-sm">
            ← Previous
          </Link>
          <Link href="/calendar" className="rounded-md border border-outline-variant px-3 py-2 text-sm">
            This week
          </Link>
          <Link href={`/calendar?week=${next}`} className="rounded-md border border-outline-variant px-3 py-2 text-sm">
            Next →
          </Link>
        </div>
      </header>

      {list.length === 0 && (
        <EmptyState title="Nothing booked this week." />
      )}

      <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-lowest">
        <div className="grid min-w-[900px] grid-cols-[4rem_repeat(7,1fr)]">
          <div className="border-b border-outline-variant bg-surface-low" />
          {dayYmds.map((d) => {
            const dt = new Date(`${d}T12:00:00Z`);
            const isToday = d === todayYmd;
            return (
              <div
                key={d}
                className={`border-b border-l border-outline-variant px-2 py-2 text-center ${
                  isToday ? "bg-primary-fixed" : "bg-surface-low"
                }`}
              >
                <div className="text-xs uppercase text-on-surface-variant">
                  {dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                </div>
                <div className="font-display text-lg">{dt.getUTCDate()}</div>
              </div>
            );
          })}

          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="h-16 border-b border-outline-variant px-2 py-1 text-right text-xs text-on-surface-variant">
                {String(hour).padStart(2, "0")}:00
              </div>
              {dayYmds.map((d) => (
                <div
                  key={`${d}-${hour}`}
                  className="relative h-16 border-b border-l border-outline-variant"
                >
                  {list
                    .filter((a) => {
                      const local = localParts(a.starts_at, tz);
                      return local.ymd === d && local.hour === hour;
                    })
                    .map((a) => {
                      const start = localParts(a.starts_at, tz);
                      const mins =
                        (new Date(a.ends_at).getTime() -
                          new Date(a.starts_at).getTime()) /
                        60000;
                      return (
                        <Link
                          key={a.id}
                          href={`/appointments/${a.id}`}
                          style={{
                            top: `${(start.minute / 60) * 100}%`,
                            height: `${(mins / 60) * 100}%`,
                          }}
                          className={`absolute inset-x-0.5 z-10 overflow-hidden rounded border px-1.5 py-0.5 text-xs leading-tight ${
                            STATUS_STYLE[a.status] ?? "bg-surface-highest border-outline-variant"
                          }`}
                        >
                          <span className="block font-medium">
                            {a.clients?.full_name ?? "Client"}
                          </span>
                          <span className="block truncate opacity-80">
                            {formatTime(a.starts_at, tz)}{" "}
                            {a.appointment_services.map((s) => s.name).join(", ")}
                          </span>
                        </Link>
                      );
                    })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The local calendar day, hour and minute of an instant in `tz`. */
function localParts(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
  };
}
