/**
 * One-time bootstrap: make a signed-up user the salon owner.
 *
 *   npx tsx scripts/promote-owner.ts ori@example.com
 *
 * The person must have signed in at least once first, so that auth.users
 * (and therefore public.profiles) has a row for them.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/promote-owner.ts <email>");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const { data, error } = await supabase
  .from("profiles")
  .update({ role: "owner" })
  .ilike("email", email)
  .select("id, email, role");

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}
if (!data || data.length === 0) {
  console.error(
    `No profile found for ${email}. Have them sign in once at /sign-in, then run this again.`,
  );
  process.exit(1);
}
console.log(`${data[0].email} is now the owner.`);
