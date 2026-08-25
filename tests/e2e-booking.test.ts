/**
 * End-to-end test of the path a real client takes: a verified user calls
 * book_appointment, the row lands as `pending`, and RLS keeps them inside
 * their own data. Runs against the live project with its own fixtures.
 */
import { readFileSync } from "node:fs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TAG = `e2e-${Date.now()}`;
const EMAIL = `${TAG}@example.invalid`;
const PASSWORD = `Test-${TAG}-pw`;

let admin: SupabaseClient;
let asClient: SupabaseClient;
let userId: string;
let staffId: string;
let serviceId: string;
let otherClientId: string;

beforeAll(async () => {
  admin = createClient(URL, SVC, { auth: { persistSession: false } });

  const { data: staff } = await admin
    .from("staff").insert({ display_name: `${TAG}-tech` }).select("id").single();
  staffId = staff!.id;

  const { data: svc } = await admin
    .from("services")
    .insert({ name: `${TAG}-service`, duration_minutes: 60, price_cents: 5000 })
    .select("id").single();
  serviceId = svc!.id;

  // Open every weekday so the horizon test below always finds a slot.
  await admin.from("availability_rules").insert(
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      staff_id: staffId, weekday, start_time: "09:00:00", end_time: "18:00:00",
    })),
  );

  // Another client's record, to prove RLS keeps it hidden.
  const { data: other } = await admin
    .from("clients").insert({ full_name: `${TAG}-someone-else` }).select("id").single();
  otherClientId = other!.id;

  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (error) throw error;
  userId = created.user!.id;

  asClient = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signInErr } = await asClient.auth.signInWithPassword({
    email: EMAIL, password: PASSWORD,
  });
  if (signInErr) throw signInErr;
});

afterAll(async () => {
  if (!admin) return;
  await admin.from("appointments").delete().eq("staff_id", staffId);
  await admin.from("availability_rules").delete().eq("staff_id", staffId);
  await admin.from("staff").delete().eq("id", staffId);
  await admin.from("services").delete().eq("id", serviceId);
  await admin.from("clients").delete().eq("id", otherClientId);
  await admin.from("clients").delete().eq("profile_id", userId);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe("client booking end to end", () => {
  it("creates a profile automatically on sign-up", async () => {
    const { data } = await admin
      .from("profiles").select("role, email").eq("id", userId).single();
    expect(data?.email).toBe(EMAIL);
    expect(data?.role).toBe("client"); // least privilege by default
  });

  it("books a slot and lands as pending for the owner to approve", async () => {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + 10);
    const date = day.toISOString().slice(0, 10);

    const { data: slots, error: slotErr } = await asClient.rpc(
      "get_available_slots",
      { p_staff_id: staffId, p_date: date, p_service_ids: [serviceId] },
    );
    expect(slotErr).toBeNull();
    expect(slots!.length).toBeGreaterThan(0);

    const { data: apptId, error } = await asClient.rpc("book_appointment", {
      p_staff_id: staffId,
      p_starts_at: slots![0].slot_start,
      p_service_ids: [serviceId],
      p_full_name: "E2E Tester",
      p_phone: "+49 000 000",
    });
    expect(error).toBeNull();
    expect(apptId).toBeTruthy();

    const { data: appt } = await admin
      .from("appointments")
      .select("status, source, client_id, appointment_services(name, price_cents)")
      .eq("id", apptId!)
      .single();

    expect(appt!.status).toBe("pending");
    expect(appt!.source).toBe("online");
    // Price is snapshotted, not referenced.
    expect(appt!.appointment_services[0].price_cents).toBe(5000);
  });

  it("refuses to double-book the slot it just took", async () => {
    const { data: mine } = await admin
      .from("appointments").select("starts_at").eq("staff_id", staffId).single();

    const { error } = await asClient.rpc("book_appointment", {
      p_staff_id: staffId,
      p_starts_at: mine!.starts_at,
      p_service_ids: [serviceId],
      p_full_name: "E2E Tester",
    });
    expect(error).not.toBeNull();
    // Matched on the Postgres error CODE, not message text, so this test
    // doesn't care what language book_appointment() raises in.
    expect(error!.code).toBe("23P01");
  });

  it("rejects a slot outside working hours", async () => {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + 11);
    const threeAm = `${day.toISOString().slice(0, 10)}T03:00:00.000Z`;

    const { error } = await asClient.rpc("book_appointment", {
      p_staff_id: staffId,
      p_starts_at: threeAm,
      p_service_ids: [serviceId],
      p_full_name: "E2E Tester",
    });
    expect(error).not.toBeNull();
  });

  it("rejects a booking inside the lead time", async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error } = await asClient.rpc("book_appointment", {
      p_staff_id: staffId,
      p_starts_at: soon,
      p_service_ids: [serviceId],
      p_full_name: "E2E Tester",
    });
    expect(error).not.toBeNull();
    // Lead-time violations raise 22023 in book_appointment(), independent
    // of the message language.
    expect(error!.code).toBe("22023");
  });

  it("shows the client their own appointment and nobody else's", async () => {
    const { data: visible } = await asClient.from("appointments").select("id, client_id");
    expect(visible!.length).toBe(1);

    const { data: clients } = await asClient.from("clients").select("id, full_name");
    expect(clients!.length).toBe(1);
    expect(clients![0].full_name).not.toContain("someone-else");
  });

  it("hides money and other clients' data from a signed-in client", async () => {
    const { data: payments } = await asClient.from("payments").select("*");
    expect(payments).toEqual([]);

    const { data: timeOff } = await asClient.from("time_off").select("*");
    expect(timeOff).toEqual([]);
  });

  it("does not let a client promote themselves to owner", async () => {
    const { error } = await asClient
      .from("profiles").update({ role: "owner" }).eq("id", userId);
    expect(error).not.toBeNull();

    const { data } = await admin.from("profiles").select("role").eq("id", userId).single();
    expect(data!.role).toBe("client");
  });

  it("still lets the service role promote someone — the owner bootstrap", async () => {
    // scripts/promote-owner.ts depends on this working.
    const { error } = await admin
      .from("profiles").update({ role: "owner" }).eq("id", userId);
    expect(error).toBeNull();

    const { data: promoted } = await admin
      .from("profiles").select("role").eq("id", userId).single();
    expect(promoted!.role).toBe("owner");

    // put it back so the remaining tests still run as a plain client
    await admin.from("profiles").update({ role: "client" }).eq("id", userId);
  });

  it("still lets a client edit their own name and phone", async () => {
    const { error } = await asClient
      .from("profiles").update({ full_name: "Renamed", phone: "+49 111" }).eq("id", userId);
    expect(error).toBeNull();

    const { data } = await admin
      .from("profiles").select("full_name, role").eq("id", userId).single();
    expect(data!.full_name).toBe("Renamed");
    expect(data!.role).toBe("client");
  });

  it("lets a client cancel their own appointment but not confirm it", async () => {
    const { data: appt } = await admin
      .from("appointments").select("id").eq("staff_id", staffId).single();

    // The WITH CHECK on appointments_self_cancel only permits `cancelled`.
    const confirm = await asClient
      .from("appointments").update({ status: "confirmed" }).eq("id", appt!.id);
    expect(confirm.error).not.toBeNull();

    const { data: unchanged } = await admin
      .from("appointments").select("status").eq("id", appt!.id).single();
    expect(unchanged!.status).toBe("pending");

    await asClient.from("appointments").update({ status: "cancelled" }).eq("id", appt!.id);
    const { data: after } = await admin
      .from("appointments").select("status").eq("id", appt!.id).single();
    expect(after!.status).toBe("cancelled");
  });
});
