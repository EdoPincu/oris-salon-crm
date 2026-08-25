"use client";

import { useTransition } from "react";
import { setAppointmentStatus, recordPayment } from "@/lib/actions";
import { PAYMENT_METHOD_LABELS } from "@/lib/format";

export function AppointmentActions({
  id,
  status,
  suggestedAmount,
  alreadyPaid,
}: {
  id: string;
  status: string;
  suggestedAmount: string;
  alreadyPaid: boolean;
}) {
  const [pending, start] = useTransition();
  const open = ["pending", "confirmed"].includes(status);

  return (
    <section className="rounded-lg border border-outline-variant bg-surface-low p-5">
      <h2 className="mb-4 text-xl">
        {alreadyPaid ? "עדכון" : "סיום טיפול"}
      </h2>

      {open && (
        <div className="mb-6 flex flex-wrap gap-2">
          {status === "pending" && (
            <button
              disabled={pending}
              onClick={() => start(() => void setAppointmentStatus(id, "confirmed"))}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
            >
              אישור
            </button>
          )}
          <button
            disabled={pending}
            onClick={() => start(() => void setAppointmentStatus(id, "cancelled"))}
            className="rounded-md border border-outline-variant px-4 py-2 text-sm disabled:opacity-60"
          >
            ביטול
          </button>
          <button
            disabled={pending}
            onClick={() => start(() => void setAppointmentStatus(id, "no_show"))}
            className="rounded-md border border-outline-variant px-4 py-2 text-sm disabled:opacity-60"
          >
            לא הגיע/ה
          </button>
        </div>
      )}

      {!alreadyPaid && (
        <form action={recordPayment} className="grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="appointment_id" value={id} />

          <label className="block">
            <span className="text-sm font-medium text-on-surface-variant">סכום</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={suggestedAmount}
              className="input mt-1"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-on-surface-variant">טיפ</span>
            <input
              name="tip"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              className="input mt-1"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-on-surface-variant">אמצעי תשלום</span>
            <select name="method" className="input mt-1" defaultValue="cash">
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-3">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
            >
              רישום תשלום וסימון כהושלם
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
