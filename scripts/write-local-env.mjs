/**
 * Writes .env.development.local from the running local Supabase stack.
 *
 *   npm run db:env        (after `npm run db:start`)
 *
 * Next.js loads `.env.development.local` ahead of `.env.local`, so once this
 * file exists `npm run dev` talks to the local stack while a production build
 * still uses `.env.local`. The file is gitignored (`.env*`).
 *
 * The keys are read from `supabase status` rather than hardcoded: they are
 * stable across restarts today, but they are generated values and not worth
 * assuming.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

let raw;
try {
  raw = execFileSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  console.error(
    `\n  ✗ Could not read the local Supabase status.\n\n` +
      `    Is the stack running? Start it with:\n` +
      `      npm run db:start\n\n` +
      `    (That needs Docker Desktop running.)\n\n` +
      `    ${String(error.stderr || error.message).trim().split("\n")[0]}\n`,
  );
  process.exit(1);
}

const status = {};
for (const line of raw.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) status[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

// Key names have shifted between CLI versions, so accept the known aliases
// rather than failing on a rename.
const pick = (...names) => names.map((n) => status[n]).find(Boolean);
const apiUrl = pick("API_URL", "SUPABASE_URL");
const anon = pick("ANON_KEY", "SUPABASE_ANON_KEY", "PUBLISHABLE_KEY");
const service = pick("SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SECRET_KEY");
const mail = pick("INBUCKET_URL", "MAILPIT_URL");

if (!apiUrl || !anon || !service) {
  console.error(
    `\n  ✗ Unexpected \`supabase status\` output — could not find the API URL and keys.\n` +
      `    Saw: ${Object.keys(status).join(", ") || "(nothing)"}\n`,
  );
  process.exit(1);
}

writeFileSync(
  ".env.development.local",
  `# Local Supabase — written by \`npm run db:env\`. Do not commit (gitignored).
#
# Next.js loads this ahead of .env.local in development, so \`npm run dev\`
# uses the local stack and never the salon's real data. \`npm run test:local\`
# loads it explicitly for the same reason.
NEXT_PUBLIC_SUPABASE_URL=${apiUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}
SUPABASE_SERVICE_ROLE_KEY=${service}
`,
);

console.log(`  ✓ wrote .env.development.local -> ${apiUrl}`);
if (mail) console.log(`  ✓ OTP codes appear at ${mail}`);
