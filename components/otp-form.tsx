"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  /** Called once the code is verified and a session exists. */
  onVerified: () => void;
  /** Extra fields stored on the auth user when the code is requested. */
  metadata?: Record<string, string>;
  submitLabel?: string;
};

// The shortest length a Supabase email OTP could plausibly be. Deliberately
// not the exact configured length — see the maxLength comment below.
const MIN_CODE_LENGTH = 6;

export function OtpForm({ onVerified, metadata, submitLabel = "המשך" }: Props) {
  const supabase = createClient();
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: metadata },
    });

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStage("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onVerified();
  }

  if (stage === "email") {
    return (
      <form onSubmit={requestCode} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-on-surface-variant">
            כתובת אימייל
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-md border border-outline-variant bg-surface-lowest px-3 py-2.5 text-on-surface placeholder:text-outline"
          />
        </label>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary disabled:opacity-60"
        >
          {busy ? "שולחים…" : "שלחו לי קוד"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        קוד אימות נשלח לכתובת <strong className="text-on-surface">{email}</strong>.
      </p>

      <label className="block">
        <span className="text-sm font-medium text-on-surface-variant">
          קוד אימות
        </span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          required
          // Not hardcoded to 6: Supabase's OTP length is a project-level Auth
          // setting, not a fixed protocol constant. A hard maxLength here
          // silently truncates a longer code and makes sign-in impossible —
          // found by testing an actual sign-in end to end, not by reading
          // the code. MIN_CODE_LENGTH below gates the submit button instead
          // of assuming an exact digit count.
          maxLength={10}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="mt-1 w-full rounded-md border border-outline-variant bg-surface-lowest px-3 py-2.5 text-center text-2xl tracking-[0.3em] text-on-surface"
        />
      </label>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={busy || code.length < MIN_CODE_LENGTH}
        className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary disabled:opacity-60"
      >
        {busy ? "בודקים…" : submitLabel}
      </button>

      <button
        type="button"
        onClick={() => {
          setStage("email");
          setCode("");
          setError(null);
        }}
        className="w-full text-sm text-on-surface-variant underline"
      >
        השתמשו בכתובת אימייל אחרת
      </button>
    </form>
  );
}
