/**
 * Everything is stored as timestamptz. These helpers turn instants into the
 * salon's local wall-clock, which is what the owner actually thinks in.
 */

export function dayRange(date: Date, timezone: string) {
  const ymd = ymdInZone(date, timezone);
  return {
    start: zonedStartOfDay(ymd, timezone),
    end: zonedStartOfDay(addDays(ymd, 1), timezone),
  };
}

export function weekRange(date: Date, timezone: string) {
  const ymd = ymdInZone(date, timezone);
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow; // weeks start Monday
  const monday = addDays(ymd, mondayOffset);
  return {
    start: zonedStartOfDay(monday, timezone),
    end: zonedStartOfDay(addDays(monday, 7), timezone),
    monday,
  };
}

/** YYYY-MM-DD for an instant, as seen in `timezone`. */
export function ymdInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The instant at which the given local day begins in `timezone`.
 * Works across DST because it measures the zone's actual offset that day.
 */
export function zonedStartOfDay(ymd: string, timezone: string): Date {
  const guess = new Date(`${ymd}T00:00:00Z`);
  const offset = zoneOffsetMs(guess, timezone);
  const first = new Date(guess.getTime() - offset);
  // Re-measure: the offset can differ on the far side of a DST boundary.
  const corrected = zoneOffsetMs(first, timezone);
  return corrected === offset
    ? first
    : new Date(guess.getTime() - corrected);
}

function zoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUTC - date.getTime();
}

export function formatTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function formatDateLong(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
