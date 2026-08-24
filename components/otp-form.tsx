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

export function OtpForm({ onVerified, metadata, submitLabel = "Continue" }: Props) {
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
            Email address
          </span>
          <input
            type="email"
            required
            autoComplete="email"
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
          {busy ? "Sending…" : "Email me a code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-4">
      <p className="text-sm text-on-surface-variant">
        We sent a 6-digit code to <strong className="text-on-surface">{email}</strong>.
      </p>

      <label className="block">
        <span className="text-sm font-medium text-on-surface-variant">
          Verification code
        </span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="mt-1 w-full rounded-md border border-outline-variant bg-surface-lowest px-3 py-2.5 text-center text-2xl tracking-[0.4em] text-on-surface"
        />
      </label>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={busy || code.length < 6}
        className="w-full rounded-md bg-primary px-4 py-2.5 font-medium text-on-primary disabled:opacity-60"
      >
        {busy ? "Checking…" : submitLabel}
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
        Use a different email
      </button>
    </form>
  );
}
