export type Channel = "email" | "sms";

export class NotConfiguredError extends Error {
  constructor(channel: Channel) {
    super(`The ${channel} channel is not configured yet.`);
    this.name = "NotConfiguredError";
  }
}

/**
 * Sends a verification code.
 *
 * Email is handled by Supabase Auth (signInWithOtp), so there is nothing to
 * do here for that channel. SMS is deliberately unimplemented in v1 — the
 * interface exists so adding Twilio later is one file, not a refactor.
 */
export async function sendCode(channel: Channel): Promise<void> {
  if (channel === "sms") throw new NotConfiguredError("sms");
}
