"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function ownerClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("לא מחוברים למערכת");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "owner") throw new Error("אין הרשאה");

  return supabase;
}

export async function setAppointmentStatus(
  id: string,
  status: "confirmed" | "cancelled" | "completed" | "no_show",
) {
  const supabase = await ownerClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath(`/appointments/${id}`);
}

export async function recordPayment(formData: FormData) {
  const supabase = await ownerClient();

  const appointmentId = String(formData.get("appointment_id"));
  const amount = Math.round(Number(formData.get("amount") ?? 0) * 100);
  const tip = Math.round(Number(formData.get("tip") ?? 0) * 100);
  const method = String(formData.get("method") ?? "cash");

  if (!Number.isFinite(amount) || amount < 0) throw new Error("סכום לא תקין");

  const { error } = await supabase.from("payments").insert({
    appointment_id: appointmentId,
    amount_cents: amount,
    tip_cents: Number.isFinite(tip) && tip > 0 ? tip : 0,
    method: method as "cash" | "card" | "transfer" | "other",
  });
  if (error) throw new Error(error.message);

  await supabase
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", appointmentId);

  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath(`/appointments/${appointmentId}`);
}

export async function saveService(formData: FormData) {
  const supabase = await ownerClient();

  const id = formData.get("id") ? String(formData.get("id")) : null;
  const row = {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    duration_minutes: Number(formData.get("duration_minutes")),
    price_cents: Math.round(Number(formData.get("price") ?? 0) * 100),
    active: formData.get("active") === "on",
  };

  if (!row.name) throw new Error("יש להזין שם");
  if (!row.duration_minutes || row.duration_minutes <= 0)
    throw new Error("משך הזמן חייב להיות גדול מאפס");

  const { error } = id
    ? await supabase.from("services").update(row).eq("id", id)
    : await supabase.from("services").insert(row);
  if (error) throw new Error(error.message);

  revalidatePath("/services");
}

export async function deleteService(id: string) {
  const supabase = await ownerClient();
  // Kept rather than deleted when it has history, so past revenue stays intact.
  const { error } = await supabase
    .from("services")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/services");
}

export async function saveClient(formData: FormData) {
  const supabase = await ownerClient();

  const id = formData.get("id") ? String(formData.get("id")) : null;
  const row = {
    full_name: String(formData.get("full_name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    allergies: String(formData.get("allergies") ?? "").trim() || null,
    birthday: String(formData.get("birthday") ?? "") || null,
  };

  if (!row.full_name) throw new Error("יש להזין שם");

  const { error } = id
    ? await supabase.from("clients").update(row).eq("id", id)
    : await supabase.from("clients").insert(row);
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  if (id) revalidatePath(`/clients/${id}`);
}

export async function saveSettings(formData: FormData) {
  const supabase = await ownerClient();

  const row = {
    display_name: String(formData.get("display_name") ?? "").trim(),
    timezone: String(formData.get("timezone") ?? "").trim(),
    currency: String(formData.get("currency") ?? "").trim().toUpperCase(),
    booking_lead_hours: Number(formData.get("booking_lead_hours")),
    booking_horizon_days: Number(formData.get("booking_horizon_days")),
    slot_granularity_minutes: Number(formData.get("slot_granularity_minutes")),
    refill_interval_weeks: Number(formData.get("refill_interval_weeks")),
    auto_confirm_online: formData.get("auto_confirm_online") === "on",
    updated_at: new Date().toISOString(),
  };

  if (!row.display_name) throw new Error("יש להזין שם לסלון");

  const { error } = await supabase.from("settings").update(row).eq("id", true);
  if (error) throw new Error(error.message);

  revalidatePath("/settings", "layout");
  revalidatePath("/", "layout");
}

export async function saveStaff(formData: FormData) {
  const supabase = await ownerClient();
  const id = formData.get("id") ? String(formData.get("id")) : null;
  const display_name = String(formData.get("display_name") ?? "").trim();
  if (!display_name) throw new Error("יש להזין שם");

  const { error } = id
    ? await supabase.from("staff").update({ display_name }).eq("id", id)
    : await supabase.from("staff").insert({ display_name });
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/calendar");
}

export async function saveHours(formData: FormData) {
  const supabase = await ownerClient();
  const staffId = String(formData.get("staff_id"));

  // Replace the whole week in one go: simpler to reason about than diffing.
  const { error: delErr } = await supabase
    .from("availability_rules")
    .delete()
    .eq("staff_id", staffId);
  if (delErr) throw new Error(delErr.message);

  const rows = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    if (formData.get(`open_${weekday}`) !== "on") continue;
    const start = String(formData.get(`start_${weekday}`) ?? "");
    const end = String(formData.get(`end_${weekday}`) ?? "");
    if (!start || !end || end <= start) continue;
    rows.push({
      staff_id: staffId,
      weekday,
      start_time: start,
      end_time: end,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("availability_rules").insert(rows);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/calendar");
}

export async function addTimeOff(formData: FormData) {
  const supabase = await ownerClient();
  const { error } = await supabase.from("time_off").insert({
    staff_id: String(formData.get("staff_id")),
    starts_at: new Date(String(formData.get("starts_at"))).toISOString(),
    ends_at: new Date(String(formData.get("ends_at"))).toISOString(),
    reason: String(formData.get("reason") ?? "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/calendar");
}

export async function removeTimeOff(id: string) {
  const supabase = await ownerClient();
  const { error } = await supabase.from("time_off").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/calendar");
}
