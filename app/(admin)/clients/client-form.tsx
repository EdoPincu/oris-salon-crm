"use client";

import { useRef } from "react";
import { saveClient } from "@/lib/actions";

type Client = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  allergies: string | null;
  birthday: string | null;
};

export function ClientForm({ client }: { client?: Client }) {
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await saveClient(fd);
        if (!client) ref.current?.reset();
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {client && <input type="hidden" name="id" value={client.id} />}

      <Field label="שם מלא">
        <input name="full_name" required defaultValue={client?.full_name} className="input" />
      </Field>
      <Field label="טלפון">
        <input name="phone" dir="ltr" defaultValue={client?.phone ?? ""} className="input" />
      </Field>
      <Field label="אימייל">
        <input name="email" type="email" dir="ltr" defaultValue={client?.email ?? ""} className="input" />
      </Field>
      <Field label="תאריך לידה">
        <input name="birthday" type="date" defaultValue={client?.birthday ?? ""} className="input" />
      </Field>
      <Field label="אלרגיות / רגישויות">
        <input
          name="allergies"
          defaultValue={client?.allergies ?? ""}
          placeholder="לדוגמה: רגישות לאצטון"
          className="input"
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="הערות">
          <textarea
            name="notes"
            rows={3}
            defaultValue={client?.notes ?? ""}
            placeholder="צורות מועדפות, צבעים, כל דבר ששווה לזכור"
            className="input"
          />
        </Field>
      </div>

      <div className="sm:col-span-2 flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
        >
          {client ? "שמירת שינויים" : "הוספת לקוח/ה"}
        </button>
      </div>
    </form>
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
