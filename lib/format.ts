/** Money is stored as integer cents everywhere; format only at the edges. */
// he-IL: the UI is Hebrew and RTL now, so the RTL marks he-IL wraps amounts
// in are correct here rather than a problem — this was en-IL while the UI
// was still English/LTR, where those marks read badly. See lib/time.ts for
// the same he-IL switch on the display-only date/time formatters.
export function formatMoney(cents: number, currency = "ILS", locale = "he-IL") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    cents / 100,
  );
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} דק׳`;
  if (m === 0) return `${h} שע׳`;
  return `${h} שע׳ ${m} דק׳`;
}

export function totalCents(items: { price_cents: number }[]) {
  return items.reduce((sum, i) => sum + i.price_cents, 0);
}

export function totalMinutes(items: { duration_minutes: number }[]) {
  return items.reduce((sum, i) => sum + i.duration_minutes, 0);
}

/** Shared between the appointment detail page and its payment form. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  card: "כרטיס אשראי",
  transfer: "העברה בנקאית",
  other: "אחר",
};
