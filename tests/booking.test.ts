/**
 * Integration tests for the booking rules.
 *
 * These run against the real project rather than a JS re-implementation:
 * availability lives in public.get_available_slots, and a mirrored copy in
 * TypeScript would be free to drift from the function that actually runs.
 *
 * Each test creates its own staff/service fixtures and removes them in
 * afterAll, so the salon's real data is never touched.
 */
import { readFileSync } from "node:fs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

let db: SupabaseClient;
let staffId: string;
let shortId: string;   // 30 min
let longId: string;    // 90 min
const TAG = `test-${Date.now()}`;

/** A date N days out that falls on a given weekday, in YYYY-MM-DD. */
function nextWeekday(weekday: number, minDaysAhead = 7): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const WEEKDAY = 3; // Wednesday
const TEST_DATE = nextWeekday(WEEKDAY);

beforeAll(async () => {
  db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: staff, error: se } = await db
    .from("staff")
    .insert({ display_name: `${TAG}-tech` })
    .select("id")
    .single();
  if (se) throw se;
  staffId = staff.id;

  const { data: services, error: ve } = await db
    .from("services")
    .insert([
      { name: `${TAG}-short`, duration_minutes: 30, price_cents: 3000 },
      { name: `${TAG}-long`, duration_minutes: 90, price_cents: 9000 },
    ])
    .select("id, duration_minutes");
  if (ve) throw ve;
  shortId = services.find((s) => s.duration_minutes === 30)!.id;
  longId = services.find((s) => s.duration_minutes === 90)!.id;

  // 09:00–17:00 on the test weekday.
  const { error: ae } = await db.from("availability_rules").insert({
    staff_id: staffId,
    weekday: WEEKDAY,
    start_time: "09:00:00",
    end_time: "17:00:00",
  });
  if (ae) throw ae;
});

afterAll(async () => {
  if (!db) return;
  await db.from("appointments").delete().eq("staff_id", staffId);
  await db.from("time_off").delete().eq("staff_id", staffId);
  await db.from("availability_rules").delete().eq("staff_id", staffId);
  await db.from("staff").delete().eq("id", staffId);
  await db.from("services").delete().like("name", `${TAG}%`);
});

async function slots(serviceIds: string[], date = TEST_DATE) {
  const { data, error } = await db.rpc("get_available_slots", {
    p_staff_id: staffId,
    p_date: date,
    p_service_ids: serviceIds,
  });
  if (error) throw error;
  return data as { slot_start: string; slot_end: string }[];
}

describe("get_available_slots", () => {
  it("offers slots on a working day at the configured granularity", async () => {
    const s = await slots([shortId]);
    expect(s.length).toBeGreaterThan(0);

    const gap =
      new Date(s[1].slot_start).getTime() - new Date(s[0].slot_start).getTime();
    expect(gap).toBe(15 * 60 * 1000); // slot_granularity_minutes default
  });

  it("offers nothing on a day with no availability rule", async () => {
    const offDay = nextWeekday((WEEKDAY + 1) % 7);
    expect(await slots([shortId], offDay)).toHaveLength(0);
  });

  it("offers nothing when no service is selected", async () => {
    expect(await slots([])).toHaveLength(0);
  });

  it("gives a longer service fewer slots, and never runs past closing", async () => {
    const short = await slots([shortId]);
    const long = await slots([longId]);

    expect(long.length).toBeLessThan(short.length);

    // A 90-minute booking cannot start late enough to end after 17:00.
    const lastLong = new Date(long[long.length - 1].slot_end);
    const lastShort = new Date(short[short.length - 1].slot_end);
    expect(lastLong.getTime()).toBeLessThanOrEqual(lastShort.getTime());
  });

  it("sums duration across multiple services", async () => {
    const combined = await slots([shortId, longId]); // 120 min total
    const long = await slots([longId]); //  90 min
    expect(combined.length).toBeLessThan(long.length);

    const first = combined[0];
    const minutes =
      (new Date(first.slot_end).getTime() -
        new Date(first.slot_start).getTime()) /
      60000;
    expect(minutes).toBe(120);
  });

  it("hides slots taken by an existing appointment", async () => {
    const before = await slots([shortId]);
    const target = before[3];

    const { data: client } = await db
      .from("clients")
      .insert({ full_name: `${TAG}-client` })
      .select("id")
      .single();

    const { error } = await db.from("appointments").insert({
      client_id: client!.id,
      staff_id: staffId,
      starts_at: target.slot_start,
      ends_at: target.slot_end,
      status: "confirmed",
    });
    expect(error).toBeNull();

    const after = await slots([shortId]);
    const stillThere = after.some((s) => s.slot_start === target.slot_start);
    expect(stillThere).toBe(false);
    expect(after.length).toBeLessThan(before.length);

    await db.from("appointments").delete().eq("staff_id", staffId);
    await db.from("clients").delete().eq("id", client!.id);
  });

  it("hides slots covered by time off", async () => {
    const before = await slots([shortId]);
    const target = before[2];

    await db.from("time_off").insert({
      staff_id: staffId,
      starts_at: target.slot_start,
      ends_at: target.slot_end,
      reason: "test",
    });

    const after = await slots([shortId]);
    expect(after.some((s) => s.slot_start === target.slot_start)).toBe(false);

    await db.from("time_off").delete().eq("staff_id", staffId);
  });

  it("respects the booking lead time", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const todaySlots = await slots([shortId], today);
    const cutoff = Date.now() + 12 * 60 * 60 * 1000; // booking_lead_hours default
    for (const s of todaySlots) {
      expect(new Date(s.slot_start).getTime()).toBeGreaterThanOrEqual(cutoff);
    }
  });

  it("offers nothing beyond the booking horizon", async () => {
    const far = new Date();
    far.setUTCDate(far.getUTCDate() + 400); // horizon default is 60 days
    expect(await slots([shortId], far.toISOString().slice(0, 10))).toHaveLength(0);
  });
});

describe("double-booking guard", () => {
  it("rejects an overlapping appointment at the database level", async () => {
    const s = await slots([longId]);
    const target = s[0];

    const { data: client } = await db
      .from("clients")
      .insert({ full_name: `${TAG}-client2` })
      .select("id")
      .single();

    const first = await db.from("appointments").insert({
      client_id: client!.id,
      staff_id: staffId,
      starts_at: target.slot_start,
      ends_at: target.slot_end,
      status: "confirmed",
    });
    expect(first.error).toBeNull();

    // Starts 30 minutes into the first booking — must be refused.
    const overlapStart = new Date(
      new Date(target.slot_start).getTime() + 30 * 60000,
    ).toISOString();
    const overlapEnd = new Date(
      new Date(target.slot_end).getTime() + 30 * 60000,
    ).toISOString();

    const second = await db.from("appointments").insert({
      client_id: client!.id,
      staff_id: staffId,
      starts_at: overlapStart,
      ends_at: overlapEnd,
      status: "confirmed",
    });
    expect(second.error).not.toBeNull();
    expect(second.error!.message).toMatch(/appointments_no_overlap|conflict|exclu/i);

    // A cancelled appointment must free its slot again.
    await db
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("staff_id", staffId);

    const third = await db.from("appointments").insert({
      client_id: client!.id,
      staff_id: staffId,
      starts_at: target.slot_start,
      ends_at: target.slot_end,
      status: "confirmed",
    });
    expect(third.error).toBeNull();

    await db.from("appointments").delete().eq("staff_id", staffId);
    await db.from("clients").delete().eq("id", client!.id);
  });
});
