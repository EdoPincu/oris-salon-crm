"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatMoney, formatDuration } from "@/lib/format";
import { OtpForm } from "@/components/otp-form";
import { ymdInZone, addDays, formatTime, formatDateLong } from "@/lib/time";

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
};
type Staff = { id: string; display_name: string };
type Slot = { slot_start: string; slot_end: string };

const STEPS = ["שירות", "מועד", "אישור"];

export function BookingWizard({
  salonName,
  currency,
  timezone,
  horizonDays,
  autoConfirm,
  services,
  staff,
}: {
  salonName: string;
  currency: string;
  timezone: string;
  horizonDays: number;
  autoConfirm: boolean;
  services: Service[];
  staff: Staff[];
}) {
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [staffId, setStaffId] = useState(staff[0].id);
  const [date, setDate] = useState(() => ymdInZone(new Date(), timezone));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [verified, setVerified] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = services.filter((s) => chosen.includes(s.id));
  const totalPrice = selected.reduce((n, s) => n + s.price_cents, 0);
  const totalMins = selected.reduce((n, s) => n + s.duration_minutes, 0);

  // Refresh slots whenever the date, tech or service mix changes.
  useEffect(() => {
    if (step !== 1 || chosen.length === 0) return;
    let cancelled = false;
    setSlots(null);

    supabase
      .rpc("get_available_slots", {
        p_staff_id: staffId,
        p_date: date,
        p_service_ids: chosen,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        setSlots((data as Slot[]) ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [step, date, staffId, chosen, supabase]);

  async function confirmBooking() {
    setBusy(true);
    setError(null);

    const { error } = await supabase.rpc("book_appointment", {
      p_staff_id: staffId,
      p_starts_at: slot!.slot_start,
      p_service_ids: chosen,
      p_full_name: name.trim(),
      p_phone: phone.trim() || undefined,
    });

    setBusy(false);
    if (error) {
      setError(error.message);
      // A lost race means the slot list is stale — send them back to pick again.
      // Matched on the Postgres error CODE, not the message text: the code is
      // language-independent, so this still works once the messages are Hebrew.
      // book_appointment() raises 23P01 for both "slot taken" and "someone just
      // took it" — see supabase/migrations/20260824180200_booking_functions.sql.
      if (error.code === "23P01") {
        setSlot(null);
        setStep(1);
      }
      return;
    }
    setBooked(true);
  }

  if (booked) {
    return (
      <Shell salonName={salonName}>
        <div className="py-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-3xl text-on-secondary-container">
            ✓
          </div>
          <h2 className="mb-2 text-2xl">
            {autoConfirm ? "נקבע לך תור" : "הבקשה נשלחה"}
          </h2>
          <p className="mb-6 text-on-surface-variant">
            {autoConfirm
              ? "שמרנו את התור. נתראה בקרוב!"
              : `${salonName} יאשרו את הבקשה בקרוב — יישלח אליך אימייל לכשהיא תאושר.`}
          </p>

          <div className="mb-6 rounded-lg border border-outline-variant bg-surface-lowest p-4 text-start">
            <div className="font-medium">
              {selected.map((s) => s.name).join(", ")}
            </div>
            <div className="mt-1 text-sm text-on-surface-variant">
              {formatDateLong(slot!.slot_start, timezone)}
            </div>
            <div className="text-sm text-on-surface-variant">
              {formatTime(slot!.slot_start, timezone)} –{" "}
              {formatTime(slot!.slot_end, timezone)} ·{" "}
              {formatDuration(totalMins)}
            </div>
            <div className="mt-2 font-medium">
              {formatMoney(totalPrice, currency)}
            </div>
          </div>

          <Link
            href="/my-appointments"
            className="inline-block rounded-md border border-outline-variant px-5 py-2.5"
          >
            התורים שלי
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell salonName={salonName}>
      <Steps current={step} />

      {error && (
        <p className="mb-4 rounded-md bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error}
        </p>
      )}

      {step === 0 && (
        <>
          <h2 className="mb-4 text-2xl">בחרו שירותים</h2>
          <ul className="space-y-3">
            {services.map((s) => {
              const on = chosen.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setChosen((c) =>
                        on ? c.filter((x) => x !== s.id) : [...c, s.id],
                      )
                    }
                    aria-pressed={on}
                    className={`flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-start transition-colors ${
                      on
                        ? "border-primary bg-primary-fixed"
                        : "border-outline-variant bg-surface-lowest"
                    }`}
                  >
                    <span className="flex-1">
                      <span className="block font-display text-lg">{s.name}</span>
                      <span className="mt-0.5 block text-sm text-on-surface-variant">
                        {formatDuration(s.duration_minutes)} ·{" "}
                        {formatMoney(s.price_cents, currency)}
                      </span>
                      {s.description && (
                        <span className="mt-1 block text-sm text-outline">
                          {s.description}
                        </span>
                      )}
                    </span>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm ${
                        on
                          ? "border-primary bg-primary text-on-primary"
                          : "border-outline"
                      }`}
                    >
                      {on ? "✓" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {staff.length > 1 && (
            <label className="mt-6 block">
              <span className="text-sm font-medium text-on-surface-variant">
                עם
              </span>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="input mt-1"
              >
                {staff.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <StickyBar
            summary={
              chosen.length === 0
                ? "בחרו לפחות שירות אחד"
                : `${formatDuration(totalMins)} · ${formatMoney(totalPrice, currency)}`
            }
            label="בחרו שעה"
            disabled={chosen.length === 0}
            onClick={() => setStep(1)}
          />
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="mb-4 text-2xl">בחרו מועד</h2>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: Math.min(horizonDays, 21) }, (_, i) =>
              addDays(ymdInZone(new Date(), timezone), i),
            ).map((d) => {
              const on = d === date;
              const dt = new Date(`${d}T12:00:00Z`);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDate(d);
                    setSlot(null);
                  }}
                  className={`flex w-16 shrink-0 flex-col items-center rounded-lg border px-2 py-2 ${
                    on
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant bg-surface-lowest"
                  }`}
                >
                  <span className="text-xs uppercase">
                    {dt.toLocaleDateString("he-IL", {
                      weekday: "short",
                      timeZone: "UTC",
                    })}
                  </span>
                  <span className="text-lg">{dt.getUTCDate()}</span>
                </button>
              );
            })}
          </div>

          <p className="mb-3 text-sm text-on-surface-variant">
            משך הטיפול: {formatDuration(totalMins)}.
          </p>

          {slots === null ? (
            <p className="py-8 text-center text-on-surface-variant">
              מחפשים מועדים פנויים…
            </p>
          ) : slots.length === 0 ? (
            <p className="rounded-lg border border-dashed border-outline-variant px-4 py-8 text-center text-on-surface-variant">
              אין מועדים פנויים ביום זה. נסו תאריך אחר.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => {
                const on = slot?.slot_start === s.slot_start;
                return (
                  <button
                    key={s.slot_start}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={`rounded-full border px-3 py-2 text-sm tabular-nums ${
                      on
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant bg-surface-lowest"
                    }`}
                  >
                    {formatTime(s.slot_start, timezone)}
                  </button>
                );
              })}
            </div>
          )}

          <StickyBar
            summary={
              slot
                ? `${formatDateLong(slot.slot_start, timezone)}, ${formatTime(slot.slot_start, timezone)}`
                : "בחרו שעה"
            }
            label="המשך"
            disabled={!slot}
            onClick={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="mb-4 text-2xl">הפרטים שלך</h2>

          <div className="mb-6 rounded-lg border border-outline-variant bg-surface-low p-4 text-sm">
            <div className="font-medium">
              {selected.map((s) => s.name).join(", ")}
            </div>
            <div className="text-on-surface-variant">
              {formatDateLong(slot!.slot_start, timezone)} ·{" "}
              {formatTime(slot!.slot_start, timezone)}
            </div>
            <div className="mt-1 font-medium">
              {formatMoney(totalPrice, currency)}
            </div>
          </div>

          {!verified ? (
            <>
              <div className="mb-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-on-surface-variant">
                    שם מלא
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    className="input mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-on-surface-variant">
                    טלפון (לא חובה)
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    dir="ltr"
                    className="input mt-1"
                  />
                </label>
              </div>

              {name.trim().length < 2 ? (
                <p className="text-sm text-on-surface-variant">
                  הזינו שם כדי להמשיך.
                </p>
              ) : (
                <OtpForm
                  metadata={{ full_name: name.trim(), phone: phone.trim() }}
                  submitLabel="אימות אימייל"
                  onVerified={() => setVerified(true)}
                />
              )}
            </>
          ) : (
            <>
              <p className="mb-4 rounded-md bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
                האימייל אומת.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={confirmBooking}
                className="w-full rounded-md bg-primary px-4 py-3 font-medium text-on-primary disabled:opacity-60"
              >
                {busy ? "קובעים תור…" : "אישור התור"}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setStep(1)}
            className="mt-4 w-full text-sm text-on-surface-variant underline"
          >
            חזרה
          </button>
        </>
      )}
    </Shell>
  );
}

function Shell({
  salonName,
  children,
}: {
  salonName: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 pb-40 pt-8">
      <h1 className="mb-6 text-center font-display text-2xl text-primary">
        {salonName}
      </h1>
      {children}
    </main>
  );
}

function Steps({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
              i <= current
                ? "bg-primary text-on-primary"
                : "bg-surface-highest text-on-surface-variant"
            }`}
          >
            {i + 1}
          </span>
          <span
            className={`text-sm ${i === current ? "font-medium" : "text-on-surface-variant"}`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <span className="mx-1 h-px w-6 bg-outline-variant" />
          )}
        </li>
      ))}
    </ol>
  );
}

function StickyBar({
  summary,
  label,
  disabled,
  onClick,
  onBack,
}: {
  summary: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-outline-variant bg-surface-container px-5 py-4">
      <div className="mx-auto max-w-lg">
        <p className="mb-2 text-center text-sm text-on-surface-variant">
          {summary}
        </p>
        <div className="flex gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-outline-variant px-4 py-3 text-sm"
            >
              חזרה
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="flex-1 rounded-md bg-primary px-4 py-3 font-medium text-on-primary disabled:opacity-50"
          >
            {label} →
          </button>
        </div>
      </div>
    </div>
  );
}
