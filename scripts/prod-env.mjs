/**
 * Runs a command against PRODUCTION, on purpose.
 *
 *   node scripts/prod-env.mjs <cmd> [args]   (used by `npm run dev:prod`)
 *
 * Why this exists: Next.js loads `.env.development.local` ahead of
 * `.env.local` in development, so once a dev database is configured a bare
 * `next dev` silently uses it — `dev:prod` would quietly not be production.
 * Variables already in the environment win over both files, so pre-loading
 * `.env.local` here makes `dev:prod` mean what it says.
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

console.log(
  `\n  ⚠ PRODUCTION database (${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname})` +
    `\n    Real clients, appointments and takings — anything you change is real.\n`,
);

const [cmd, ...args] = process.argv.slice(2);
spawn(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } }).on(
  "exit",
  (code) => process.exit(code ?? 1),
);
