import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatDuration } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { ServiceForm } from "./service-form";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const supabase = await createClient();
  const [{ data: services }, { data: settings }] = await Promise.all([
    supabase.from("services").select("*").order("sort_order").order("name"),
    supabase.from("settings").select("currency").single(),
  ]);

  const currency = settings?.currency ?? "EUR";
  const list = services ?? [];

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl">Services</h1>
        <p className="mt-1 text-on-surface-variant">
          What clients can book, how long it takes and what it costs.
        </p>
      </header>

      {list.length === 0 ? (
        <EmptyState
          title="No services yet."
          hint="Add your first one below — clients can't book until at least one exists."
        />
      ) : (
        <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-lowest">
          {list.map((s) => (
            <li key={s.id} className="px-4 py-3">
              <details>
                <summary className="flex cursor-pointer items-center gap-4">
                  <span className="flex-1">
                    <span className={s.active ? "" : "text-outline line-through"}>
                      {s.name}
                    </span>
                    {s.description && (
                      <span className="block text-sm text-on-surface-variant">
                        {s.description}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-on-surface-variant">
                    {formatDuration(s.duration_minutes)}
                  </span>
                  <span className="w-20 text-right font-medium tabular-nums">
                    {formatMoney(s.price_cents, currency)}
                  </span>
                </summary>
                <div className="mt-4 border-t border-outline-variant pt-4">
                  <ServiceForm service={s} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-lg border border-outline-variant bg-surface-low p-5">
        <h2 className="mb-4 text-xl">Add a service</h2>
        <ServiceForm />
      </section>
    </div>
  );
}
