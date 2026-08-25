/**
 * Everything is stored as timestamptz. These helpers turn instants into the
 * salon's local wall-clock, which is what the owner actually thinks in.
 */

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;

/** True for a plain "YYYY-MM-DD" string — guards against malformed search params. */
export function isValidYmd(s: string): boolean {
  return YMD_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

/** True for a plain "YYYY-MM" string — guards against malformed search params. */
export function isValidYearMonth(s: string): boolean {
  return YEAR_MONTH_RE.test(s) && !Number.isNaN(new Date(`${s}-01T00:00:00Z`).getTime());
}

export function dayRange(date: Date, timezone: string) {
  const ymd = ymdInZone(date, timezone);
  return {
    start: zonedStartOfDay(ymd, timezone),
    end: zonedStartOfDay(addDays(ymd, 1), timezone),
  };
}

export function weekRange(date: Date, timezone: string) {
  const ymd = ymdInZone(date, timezone);
  // Weeks run Sunday to Saturday, as they do in Israel.
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const weekStart = addDays(ymd, -dow);
  return {
    start: zonedStartOfDay(weekStart, timezone),
    end: zonedStartOfDay(addDays(weekStart, 7), timezone),
    weekStart,
  };
}

/** The calendar month containing `date`, as seen in `timezone`. */
export function monthRange(date: Date, timezone: string) {
  const month = ymdInZone(date, timezone).slice(0, 7); // "2026-08"
  return {
    start: zonedStartOfDay(`${month}-01`, timezone),
    end: zonedStartOfDay(`${addMonths(month, 1)}-01`, timezone),
    month,
  };
}

/**
 * "2026-12" + 1 -> "2027-01". Deliberately string/integer maths rather than
 * Date.setMonth, which overflows short months (Jan 31 + 1 month = Mar 3).
 */
export function addMonths(month: string, months: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const mon = total - year * 12 + 1;
  return `${String(year).padStart(4, "0")}-${String(mon).padStart(2, "0")}`;
}

/** How many days the given "YYYY-MM" has. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
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

// he-IL below: these three are DISPLAY formatters — safe to localise.
// ymdInZone and zoneOffsetMs above stay en-CA/en-US on purpose: their output
// is parsed as machine data (slot lookups, calendar grid placement), and
// localising them would silently break that without an error. See
// tests/time.test.ts, which pins ymdInZone to plain ASCII YYYY-MM-DD.

/**
 * Renders a bare YYYY-MM-DD (a local calendar day, not an instant) in Hebrew.
 * The UTC-noon anchor plus timeZone:"UTC" is what keeps the day from shifting:
 * re-zoning a date that is *already* local would move it by a day near the
 * boundaries. Don't "simplify" this to new Date(ymd) in the shop timezone.
 */
export function formatYmd(ymd: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("he-IL", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${ymd}T12:00:00Z`));
}

export function formatTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function formatDateLong(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
