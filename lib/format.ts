/** Money is stored as integer cents everywhere; format only at the edges. */
// en-IL renders ILS as a plain "₪1,234.50"; he-IL wraps it in RTL marks
// that read badly inside this English, left-to-right UI.
export function formatMoney(cents: number, currency = "ILS", locale = "en-IL") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    cents / 100,
  );
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function totalCents(items: { price_cents: number }[]) {
  return items.reduce((sum, i) => sum + i.price_cents, 0);
}

export function totalMinutes(items: { duration_minutes: number }[]) {
  return items.reduce((sum, i) => sum + i.duration_minutes, 0);
}
