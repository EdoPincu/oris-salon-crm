"use client";

import { useRef } from "react";
import { saveService, deleteService } from "@/lib/actions";

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
};

export function ServiceForm({ service }: { service?: Service }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await saveService(fd);
        if (!service) formRef.current?.reset();
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {service && <input type="hidden" name="id" value={service.id} />}

      <Field label="שם">
        <input
          name="name"
          required
          defaultValue={service?.name}
          placeholder="מניקור ג'ל"
          className="input"
        />
      </Field>

      <Field label="תיאור">
        <input
          name="description"
          defaultValue={service?.description ?? ""}
          placeholder="לא חובה"
          className="input"
        />
      </Field>

      <Field label="משך (בדקות)">
        <input
          name="duration_minutes"
          type="number"
          min={5}
          step={5}
          required
          defaultValue={service?.duration_minutes ?? 60}
          className="input"
        />
      </Field>

      <Field label="מחיר">
        <input
          name="price"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={service ? (service.price_cents / 100).toFixed(2) : ""}
          placeholder="45.00"
          className="input"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={service?.active ?? true}
        />
        זמין להזמנה
      </label>

      <div className="flex justify-end gap-2 sm:col-span-2">
        {service && (
          <button
            type="button"
            onClick={() => void deleteService(service.id)}
            className="rounded-md border border-outline-variant px-4 py-2 text-sm"
          >
            הפסקת שירות
          </button>
        )}
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
        >
          {service ? "שמירת שינויים" : "הוספת שירות"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-on-surface-variant">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
