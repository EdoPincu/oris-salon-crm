import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Role = Database["public"]["Enums"]["user_role"];

/**
 * The signed-in user's role, or null if signed out.
 *
 * Read-only and non-throwing on purpose, so it can drive conditional
 * rendering. This is deliberately NOT an authorization gate — for that use
 * `ownerClient()` in lib/actions.ts, which throws, or the middleware, which
 * redirects. The real boundary is RLS either way.
 */
export async function currentRole(): Promise<Role | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role ?? null;
}

export async function isOwner(): Promise<boolean> {
  return (await currentRole()) === "owner";
}
