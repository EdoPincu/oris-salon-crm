"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function CancelButton({ id }: { id: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    // RLS only lets a client move their own appointment to `cancelled`.
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id);
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="mt-3 text-sm text-on-surface-variant underline"
      >
        Cancel this appointment
      </button>
    );
  }

  return (
    <div className="mt-3">
      <p className="text-sm text-on-surface-variant">Cancel this appointment?</p>
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          disabled={busy}
          onClick={cancel}
          className="rounded-md bg-error px-3 py-1.5 text-sm text-on-error disabled:opacity-60"
        >
          {busy ? "Cancelling…" : "Yes, cancel"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md border border-outline-variant px-3 py-1.5 text-sm"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
