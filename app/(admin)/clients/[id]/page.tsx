import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { formatDate, formatTime } from "@/lib/time";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import { ClientForm } from "../client-form";

export const dynamic = "force-dynamic";

export default async function ClientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: settings }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("settings").select("currency, timezone").single(),
  ]);

  if (!client) notFound();

  const tz = settings?.timezone ?? "Asia/Jerusalem";
  const currency = settings?.currency ?? "ILS";

  const { data: visits } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, status, staff(display_name), appointment_services(name, price_cents), payments(amount_cents, tip_cents)",
    )
    .eq("client_id", id)
    .order("starts_at", { ascending: false });

  const all = visits ?? [];
  const completed = all.filter((v) => v.status === "completed");
  const upcoming = all
    .filter(
      (v) =>
        ["pending", "confirmed"].includes(v.status) &&
        new Date(v.starts_at) >= new Date(),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const lifetime = completed.reduce(
    (sum, v) =>
      sum + v.payments.reduce((n, p) => n + p.amount_cents + p.tip_cents, 0),
    0,
  );

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link href="/clients" className="text-sm text-on-surface-variant hover:underline">
          ← All clients
        </Link>
      </div>

      <header className="flex items-start gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-lg font-medium text-on-primary-container">
          {client.full_name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
        </span>
        <div className="flex-1">
          <h1 className="text-3xl">{client.full_name}</h1>
          <p className="mt-1 text-on-surface-variant">
            {[client.phone, client.email].filter(Boolean).join(" · ") || "No contact details"}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Visits" value={String(completed.length)} />
        <Stat label="Lifetime spend" value={formatMoney(lifetime, currency)} />
        <Stat
          label="Last visit"
          value={completed[0] ? formatDate(completed[0].starts_at, tz) : "—"}
        />
        <Stat
          label="Next appointment"
          value={upcoming[0] ? formatDate(upcoming[0].starts_at, tz) : "—"}
        />
      </div>

      {client.allergies && (
        <div className="rounded-lg border border-error bg-error-container px-4 py-3 text-on-error-container">
          <strong className="text-sm uppercase tracking-wide">Allergies</strong>
          <p className="mt-1">{client.allergies}</p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <h2 className="mb-3 text-xl">Visit history</h2>
          {all.length === 0 ? (
            <EmptyState title="No appointments yet." />
          ) : (
            <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-lowest">
              {all.map((v) => {
                const paid = v.payments.reduce(
                  (n, p) => n + p.amount_cents + p.tip_cents,
                  0,
                );
                return (
                  <li key={v.id} className="px-4 py-3">
                    <Link href={`/appointments/${v.id}`} className="block hover:underline">
                      <div className="flex items-center gap-3">
                        <span className="flex-1 font-medium">
                          {formatDate(v.starts_at, tz)} · {formatTime(v.starts_at, tz)}
                        </span>
                        <StatusChip status={v.status} />
                      </div>
                      <div className="mt-1 flex justify-between text-sm text-on-surface-variant">
                        <span>
                          {v.appointment_services.map((s) => s.name).join(", ") || "—"}
                        </span>
                        {paid > 0 && (
                          <span className="tabular-nums">
                            {formatMoney(paid, currency)}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl">Notes</h2>
          <div className="rounded-lg border border-outline-variant bg-surface-lowest p-4">
            {client.notes ? (
              <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
            ) : (
              <p className="text-sm text-outline">Nothing noted yet.</p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-outline-variant bg-surface-low p-5">
        <h2 className="mb-4 text-xl">Edit details</h2>
        <ClientForm client={client} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-lowest px-4 py-4">
      <div className="text-sm text-on-surface-variant">{label}</div>
      <div className="mt-1 font-display text-xl">{value}</div>
    </div>
  );
}
