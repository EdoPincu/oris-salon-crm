import { createClient } from "@/lib/supabase/server";
import { saveStaff, saveHours } from "@/lib/actions";

// Sunday first, Saturday last — the Israeli working week.
const DAYS = [
  { n: 0, label: "Sunday" },
  { n: 1, label: "Monday" },
  { n: 2, label: "Tuesday" },
  { n: 3, label: "Wednesday" },
  { n: 4, label: "Thursday" },
  { n: 5, label: "Friday" },
  { n: 6, label: "Saturday" },
];

type Staff = { id: string; display_name: string };

export async function StaffHours({ staff }: { staff: Staff[] }) {
  const supabase = await createClient();
  const { data: rules } = await supabase.from("availability_rules").select("*");

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl">Working hours</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Clients can only book inside these hours.
        </p>
      </div>

      {staff.length === 0 && (
        <form
          action={saveStaff}
          className="flex items-end gap-3 rounded-lg border border-dashed border-outline-variant p-5"
        >
          <label className="flex-1">
            <span className="text-sm font-medium text-on-surface-variant">
              Add yourself as the first tech
            </span>
            <input
              name="display_name"
              required
              placeholder="Ori"
              className="input mt-1"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
          >
            Add
          </button>
        </form>
      )}

      {staff.map((member) => {
        const mine = (rules ?? []).filter((r) => r.staff_id === member.id);
        return (
          <form
            key={member.id}
            action={saveHours}
            className="rounded-lg border border-outline-variant bg-surface-lowest p-5"
          >
            <input type="hidden" name="staff_id" value={member.id} />
            <h3 className="mb-4 font-medium">{member.display_name}</h3>

            <div className="space-y-2">
              {DAYS.map((day) => {
                const rule = mine.find((r) => r.weekday === day.n);
                return (
                  <div key={day.n} className="flex items-center gap-3">
                    <label className="flex w-36 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name={`open_${day.n}`}
                        defaultChecked={Boolean(rule)}
                      />
                      {day.label}
                    </label>
                    <input
                      type="time"
                      name={`start_${day.n}`}
                      defaultValue={rule?.start_time?.slice(0, 5) ?? "09:00"}
                      className="input w-32"
                    />
                    <span className="text-on-surface-variant">to</span>
                    <input
                      type="time"
                      name={`end_${day.n}`}
                      defaultValue={rule?.end_time?.slice(0, 5) ?? "17:00"}
                      className="input w-32"
                    />
                  </div>
                );
              })}
            </div>

            <button
              type="submit"
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary"
            >
              Save hours
            </button>
          </form>
        );
      })}
    </section>
  );
}
