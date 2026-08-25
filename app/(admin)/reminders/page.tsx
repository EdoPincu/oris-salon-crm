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

  const tz = settings?.timezone ?? "Asia/Jerusalem";
  const salon = settings?.display_name ?? "הסלון";

  const dueRows = (refill ?? []).map((r) => ({
    id: r.client_id,
    name: r.full_name,
    phone: r.phone,
    lastVisit: formatDate(r.last_visit, tz),
    weeks: r.weeks_since,
    usual: r.usual_service,
    message:
      `היי ${r.full_name.split(/\s+/)[0]}! עברו כבר ${r.weeks_since} שבועות מאז ` +
      `${r.usual_service ?? "התור"} האחרון שלך — רוצה לקבוע את הבא? ` +
      `תכתבי לי איזה יום מתאים לך. — ${salon}`,
  }));

  const lapsedRows = (lapsed ?? []).map((r) => ({
    id: r.client_id,
    name: r.full_name,
    phone: r.phone,
    lastVisit: formatDate(r.last_visit, tz),
    weeks: r.weeks_since,
    usual: null,
    message:
      `היי ${r.full_name.split(/\s+/)[0]}! מזמן לא ראינו אותך ורצינו לומר שלום. ` +
      `אם בא לך לבוא, רק תכתבי לי. — ${salon}`,
  }));

  return (
    <div className="max-w-5xl space-y-10">
      <header>
        <h1 className="text-3xl">מעקבים</h1>
        <p className="mt-1 text-on-surface-variant">
          לקוחות ששווה לשלוח להם הודעה. העתיקו את הטקסט ושלחו מהטלפון שלכם.
        </p>
      </header>

      <section>
        <h2 className="mb-1 text-xl">ממתינים למילוי</h2>
        <p className="mb-3 text-sm text-on-surface-variant">
          הביקור האחרון היה לפני יותר מ-{settings?.refill_interval_weeks ?? 3} שבועות,
          ואין תור עתידי.
        </p>
        {dueRows.length === 0 ? (
          <EmptyState
            title="אין כרגע מי שמאחר/ת."
            hint="הרשימה תתמלא ככל שביקורים יושלמו."
          />
        ) : (
          <FollowUpTable rows={dueRows} />
        )}
      </section>

      <section>
        <h2 className="mb-1 text-xl">לא ביקרו כבר זמן מה</h2>
        <p className="mb-3 text-sm text-on-surface-variant">
          לקוחות שכבר לא חוזרים.
        </p>
        {lapsedRows.length === 0 ? (
          <EmptyState title="אין לקוחות שנעלמו." />
        ) : (
          <FollowUpTable rows={lapsedRows} />
        )}
      </section>
    </div>
  );
}
