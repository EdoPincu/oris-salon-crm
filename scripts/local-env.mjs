/**
 * Guards local development against touching the production database.
 *
 *   node scripts/local-env.mjs               assert only (used by `npm run dev`)
 *   node scripts/local-env.mjs <cmd> [args]  assert, then run <cmd> with local env
 *
 * Why this exists: `.env.local` holds the *production* Supabase credentials
 * and Next.js loads it in every environment. If `.env.development.local` is
 * missing, `npm run dev` would quietly fall back to it and point a dev server
 * at the salon's real clients, appointments and takings — with no visible
 * sign that anything is wrong. This turns that silent fallback into a refusal.
 *
 * Tests need the same protection and a bit more: tests/*.test.ts read
 * `.env.local` by name, but only set a variable when it is not already set,
 * so pre-loading the local values into the environment wins.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";

const ENV_FILE = ".env.development.local";
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function die(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

function parseEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Local means loopback. Anything else is somebody's real database. */
function isLocal(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
  } catch {
    return false;
  }
}

if (!existsSync(ENV_FILE)) {
  die(
    `${ENV_FILE} not found — refusing to start against production.\n\n` +
      `    Start the local stack and write the file:\n` +
      `      npm run db:start\n` +
      `      npm run db:env\n`,
  );
}

const env = parseEnvFile(ENV_FILE);

const missing = REQUIRED.filter((k) => !env[k]);
if (missing.length) die(`${ENV_FILE} is missing: ${missing.join(", ")}`);

if (!isLocal(env.NEXT_PUBLIC_SUPABASE_URL)) {
  die(
    `${ENV_FILE} does not point at a local Supabase.\n\n` +
      `    Found host: ${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname}\n` +
      `    Expected:   127.0.0.1\n\n` +
      `    This file is for the local stack only. Regenerate it with:\n` +
      `      npm run db:env\n`,
  );
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.log(`  ✓ local Supabase (${env.NEXT_PUBLIC_SUPABASE_URL})`);
  process.exit(0);
}

// Pre-set so the test files' `if (!process.env[k])` guard keeps these and
// ignores the production values in .env.local.
spawn(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } }).on(
  "exit",
  (code) => process.exit(code ?? 1),
);
