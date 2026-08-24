"use client";

import { useTransition } from "react";
import { setAppointmentStatus } from "@/lib/actions";

export function PendingRequest({
  id,
  clientName,
  phone,
  when,
  services,
  total,
}: {
  id: string;
  clientName: string;
  phone: string | null;
  when: string;
  services: string[];
  total: string;
}) {
  const [pending, start] = useTransition();

  return (
    <li className="rounded-lg border border-outline-variant bg-surface-lowest px-4 py-3">
      <div className="font-medium">{clientName}</div>
      <div className="text-sm text-on-surface-variant">{when}</div>
      <div className="mt-1 text-sm">
        {services.join(", ") || "No services"} · {total}
      </div>
      {phone && <div className="text-sm text-outline">{phone}</div>}

      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={() => start(() => void setAppointmentStatus(id, "confirmed"))}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-on-primary disabled:opacity-60"
        >
          Approve
        </button>
        <button
          disabled={pending}
          onClick={() => start(() => void setAppointmentStatus(id, "cancelled"))}
          className="rounded-md border border-outline-variant px-3 py-1.5 text-sm disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    </li>
  );
}
