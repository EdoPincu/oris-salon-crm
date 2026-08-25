import { createClient } from "@/lib/supabase/server";
import { saveSettings } from "@/lib/actions";
import { StaffHours } from "./staff-hours";

export const dynamic = "force-dynamic";

const TIMEZONES = [
  "Europe/Berlin", "Europe/London", "Europe/Paris", "Europe/Madrid",
  "Europe/Rome", "Europe/Amsterdam", "Europe/Warsaw", "Europe/Bucharest",
  "Europe/Athens", "Asia/Jerusalem", "Asia/Dubai", "America/New_York",
  "America/Chicago", "America/Los_Angeles", "UTC",
];

const CURRENCIES = ["EUR", "GBP", "USD", "ILS", "CHF", "PLN", "RON", "SEK"];

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: staff }] = await Promise.all([
    supabase.from("settings").select("*").single(),
    supabase.from("staff").select("*").order("sort_order").order("display_name"),
  ]);

  if (!settings) return <p>שורת ההגדרות חסרה.</p>;

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-3xl">הגדרות</h1>
      </header>

      <form action={saveSettings} className="space-y-6">
        <section className="rounded-lg border border-outline-variant bg-surface-lowest p-5">
          <h2 className="mb-4 text-xl">הסלון</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="שם המוצג ללקוחות">
              <input
                name="display_name"
                required
                defaultValue={settings.display_name}
                className="input"
              />
            </Field>
            <Field label="אזור זמן">
              <select name="timezone" defaultValue={settings.timezone} className="input">
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </Field>
            <Field label="מטבע">
              <select name="currency" defaultValue={settings.currency} className="input">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant bg-surface-lowest p-5">
          <h2 className="mb-4 text-xl">הזמנה מקוונת</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="התראה מינימלית (שעות)">
              <input
                name="booking_lead_hours"
                type="number"
                min={0}
                defaultValue={settings.booking_lead_hours}
                className="input"
              />
            </Field>
            <Field label="עד כמה זמן קדימה ניתן להזמין (ימים)">
              <input
                name="booking_horizon_days"
                type="number"
                min={1}
                defaultValue={settings.booking_horizon_days}
                className="input"
              />
            </Field>
            <Field label="מרווח בין תורים (דקות)">
              <input
                name="slot_granularity_minutes"
                type="number"
                min={5}
                step={5}
                defaultValue={settings.slot_granularity_minutes}
                className="input"
              />
            </Field>
            <Field label="תזכורת מילוי אחרי (שבועות)">
              <input
                name="refill_interval_weeks"
                type="number"
                min={1}
                defaultValue={settings.refill_interval_weeks}
                className="input"
              />
            </Field>
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="auto_confirm_online"
              defaultChecked={settings.auto_confirm_online}
              className="mt-1"
            />
            <span>
              אישור אוטומטי של הזמנות מקוונות
              <span className="block text-on-surface-variant">
                השאירו כבוי כדי שבקשות ימתינו ללוח הבקרה שלכם לאישור.
              </span>
            </span>
          </label>
        </section>

        <button
          type="submit"
          className="rounded-md bg-primary px-5 py-2.5 font-medium text-on-primary"
        >
          שמירת הגדרות
        </button>
      </form>

      <StaffHours staff={staff ?? []} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-on-surface-variant">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
