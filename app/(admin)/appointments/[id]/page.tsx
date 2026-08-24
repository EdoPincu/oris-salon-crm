import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatDuration } from "@/lib/format";
import { formatDateLong, formatTime } from "@/lib/time";
import { StatusChip } from "@/components/status-chip";
import { AppointmentActions } from "./actions-panel";

export const dynamic = "force-dynamic";

export default async function AppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: appt }, { data: settings }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "*, clients(id, full_name, phone, email, allergies), staff(display_name), appointment_services(name, price_cents, duration_minutes), payments(id, amount_cents, tip_cents, method, paid_at)",
      )
      .eq("id", id)
      .single(),
    supabase.from("settings").select("timezone, currency").single(),
  ]);

  if (!appt) notFound();

  const tz = settings?.timezone ?? "UTC";
  const currency = settings?.currency ?? "EUR";
  const due = appt.appointment_services.reduce((n, s) => n + s.price_cents, 0);
  const mins = appt.appointment_services.reduce((n, s) => n + s.duration_minutes, 0);
  const paid = appt.payments.reduce((n, p) => n + p.amount_cents + p.tip_cents, 0);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href="/calendar" className="text-sm text-on-surface-variant hover:underline">
          ← Calendar
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">
            {formatDateLong(appt.starts_at, tz)}
          </h1>
          <p className="mt-1 text-on-surface-variant">
            {formatTime(appt.starts_at, tz)} – {formatTime(appt.ends_at, tz)} ·{" "}
            {formatDuration(mins)}
            {appt.staff?.display_name ? ` · ${appt.staff.display_name}` : ""}
          </p>
        </div>
        <StatusChip status={appt.status} />
      </header>

      <section className="rounded-lg border border-outline-variant bg-surface-lowest p-5">
        <h2 className="mb-3 text-xl">Client</h2>
        <Link
          href={`/clients/${appt.clients?.id}`}
          className="font-medium hover:underline"
        >
          {appt.clients?.full_name}
        </Link>
        <p className="text-sm text-on-surface-variant">
          {[appt.clients?.phone, appt.clients?.email].filter(Boolean).join(" · ") || "No contact details"}
        </p>
        {appt.clients?.allergies && (
          <p className="mt-3 rounded-md bg-error-container px-3 py-2 text-sm text-on-error-container">
            <strong>Allergies:</strong> {appt.clients.allergies}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-outline-variant bg-surface-lowest p-5">
        <h2 className="mb-3 text-xl">Services</h2>
        <ul className="divide-y divide-outline-variant">
          {appt.appointment_services.map((s, i) => (
            <li key={i} className="flex justify-between py-2 text-sm">
              <span>
                {s.name}
                <span className="ml-2 text-on-surface-variant">
                  {formatDuration(s.duration_minutes)}
                </span>
              </span>
              <span className="tabular-nums">{formatMoney(s.price_cents, currency)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-outline-variant pt-3 font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(due, currency)}</span>
        </div>
        {appt.notes && (
          <p className="mt-4 whitespace-pre-wrap rounded-md bg-surface-low px-3 py-2 text-sm">
            {appt.notes}
          </p>
        )}
      </section>

      {appt.payments.length > 0 && (
        <section className="rounded-lg border border-outline-variant bg-surface-lowest p-5">
          <h2 className="mb-3 text-xl">Payment</h2>
          <ul className="divide-y divide-outline-variant">
            {appt.payments.map((p) => (
              <li key={p.id} className="flex justify-between py-2 text-sm">
                <span className="capitalize">{p.method}</span>
                <span className="tabular-nums">
                  {formatMoney(p.amount_cents, currency)}
                  {p.tip_cents > 0 && (
                    <span className="ml-2 text-on-surface-variant">
                      +{formatMoney(p.tip_cents, currency)} tip
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-outline-variant pt-3 font-medium">
            <span>Taken</span>
            <span className="tabular-nums">{formatMoney(paid, currency)}</span>
          </div>
        </section>
      )}

      <AppointmentActions
        id={appt.id}
        status={appt.status}
        suggestedAmount={(due / 100).toFixed(2)}
        alreadyPaid={appt.payments.length > 0}
      />
    </div>
  );
}
