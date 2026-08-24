import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { EmptyState } from "@/components/empty-state";
import { FollowUpTable } from "./follow-up-table";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const supabase = await createClient();

  const [{ data: settings }, { data: refill }, { data: lapsed }] =
    await Promise.all([
      supabase.from("settings").select("display_name, timezone, refill_interval_weeks").single(),
      supabase.rpc("clients_due_for_refill"),
      supabase.rpc("clients_lapsed"),
    ]);

  const tz = settings?.timezone ?? "UTC";
  const salon = settings?.display_name ?? "the salon";

  const dueRows = (refill ?? []).map((r) => ({
    id: r.client_id,
    name: r.full_name,
    phone: r.phone,
    lastVisit: formatDate(r.last_visit, tz),
    weeks: r.weeks_since,
    usual: r.usual_service,
    message:
      `Hi ${r.full_name.split(/\s+/)[0]}! It's been ${r.weeks_since} weeks since your last ` +
      `${r.usual_service ?? "appointment"} — would you like to book your next one? ` +
      `Just let me know what day suits. — ${salon}`,
  }));

  const lapsedRows = (lapsed ?? []).map((r) => ({
    id: r.client_id,
    name: r.full_name,
    phone: r.phone,
    lastVisit: formatDate(r.last_visit, tz),
    weeks: r.weeks_since,
    usual: null,
    message:
      `Hi ${r.full_name.split(/\s+/)[0]}! We haven't seen you in a while and wanted to ` +
      `say hello. If you'd like to come in, just let me know. — ${salon}`,
  }));

  return (
    <div className="max-w-5xl space-y-10">
      <header>
        <h1 className="text-3xl">Follow-ups</h1>
        <p className="mt-1 text-on-surface-variant">
          Clients worth a message. Copy the text and send it from your own phone.
        </p>
      </header>

      <section>
        <h2 className="mb-1 text-xl">Due for a refill</h2>
        <p className="mb-3 text-sm text-on-surface-variant">
          Last visit over {settings?.refill_interval_weeks ?? 3} weeks ago, with
          nothing booked.
        </p>
        {dueRows.length === 0 ? (
          <EmptyState
            title="Nobody is overdue."
            hint="This fills up as visits are completed."
          />
        ) : (
          <FollowUpTable rows={dueRows} />
        )}
      </section>

      <section>
        <h2 className="mb-1 text-xl">Haven&apos;t been in a while</h2>
        <p className="mb-3 text-sm text-on-surface-variant">
          Clients who have drifted away entirely.
        </p>
        {lapsedRows.length === 0 ? (
          <EmptyState title="No lapsed clients." />
        ) : (
          <FollowUpTable rows={lapsedRows} />
        )}
      </section>
    </div>
  );
}
