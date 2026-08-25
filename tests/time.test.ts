import { describe, expect, it } from "vitest";
import {
  zonedStartOfDay,
  ymdInZone,
  addDays,
  weekRange,
  monthRange,
  addMonths,
  daysInMonth,
  formatYmd,
  dayRange,
  formatDateLong,
} from "@/lib/time";

const TZ = "Europe/Berlin";

// Guards for the Hebrew/RTL conversion: ymdInZone and the other machine
// formatters in lib/time.ts must stay en-CA/en-US no matter what locale the
// display formatters use, since their output is parsed as data (slot
// lookups, calendar grid placement) rather than shown to anyone. See
// AGENTS.md "Security" section and the note on lib/time.ts's he-IL block.
describe("ymdInZone stays machine-format under a Hebrew UI", () => {
  it("returns plain ASCII digits, not Hebrew-formatted output", () => {
    const ymd = ymdInZone(new Date("2026-07-15T09:00:00Z"), TZ);
    expect(ymd).toBe("2026-07-15");
    expect(ymd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatDateLong is Hebrew, by contrast", () => {
  it("renders a Hebrew weekday and month name", () => {
    const s = formatDateLong("2026-07-15T09:00:00Z", TZ);
    expect(s).toMatch(/[֐-׿]/); // contains a Hebrew character
  });
});

describe("zonedStartOfDay", () => {
  it("returns local midnight in winter (UTC+1)", () => {
    const d = zonedStartOfDay("2026-01-15", TZ);
    expect(d.toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("returns local midnight in summer (UTC+2)", () => {
    const d = zonedStartOfDay("2026-07-15", TZ);
    expect(d.toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });

  it("handles the spring-forward day, when 02:00 does not exist", () => {
    // Berlin springs forward on 2026-03-29.
    const d = zonedStartOfDay("2026-03-29", TZ);
    expect(d.toISOString()).toBe("2026-03-28T23:00:00.000Z");
  });

  it("handles the autumn fall-back day, when 02:00 happens twice", () => {
    // Berlin falls back on 2026-10-25.
    const d = zonedStartOfDay("2026-10-25", TZ);
    expect(d.toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });

  it("gives a 25-hour day across the fall-back boundary", () => {
    const start = zonedStartOfDay("2026-10-25", TZ);
    const end = zonedStartOfDay("2026-10-26", TZ);
    expect((end.getTime() - start.getTime()) / 3600_000).toBe(25);
  });

  it("gives a 23-hour day across the spring-forward boundary", () => {
    const start = zonedStartOfDay("2026-03-29", TZ);
    const end = zonedStartOfDay("2026-03-30", TZ);
    expect((end.getTime() - start.getTime()) / 3600_000).toBe(23);
  });

  it("works for a zone with a half-hour offset", () => {
    const d = zonedStartOfDay("2026-06-01", "Asia/Kolkata"); // UTC+5:30
    expect(d.toISOString()).toBe("2026-05-31T18:30:00.000Z");
  });
});

describe("ymdInZone", () => {
  it("reports the local day, not the UTC one", () => {
    // 22:30 UTC is already the next day in Berlin (00:30 summer time).
    const instant = new Date("2026-07-14T22:30:00Z");
    expect(ymdInZone(instant, TZ)).toBe("2026-07-15");
    expect(ymdInZone(instant, "UTC")).toBe("2026-07-14");
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is unaffected by a DST transition", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
  });
});

describe("weekRange", () => {
  it("starts weeks on Sunday", () => {
    // 2026-07-15 is a Wednesday; the Sunday before it is the 12th.
    const w = weekRange(new Date("2026-07-15T12:00:00Z"), TZ);
    expect(w.weekStart).toBe("2026-07-12");
  });

  it("treats Sunday as the first day, not the last", () => {
    // 2026-07-19 is itself a Sunday, so it opens its own week.
    const w = weekRange(new Date("2026-07-19T12:00:00Z"), TZ);
    expect(w.weekStart).toBe("2026-07-19");
  });

  it("puts Saturday at the end of the week", () => {
    // 2026-07-18 is a Saturday, closing the week that began on the 12th.
    const w = weekRange(new Date("2026-07-18T12:00:00Z"), TZ);
    expect(w.weekStart).toBe("2026-07-12");
    expect(addDays(w.weekStart, 6)).toBe("2026-07-18");
  });

  it("spans seven local days across a normal week", () => {
    const w = weekRange(new Date("2026-07-15T12:00:00Z"), TZ);
    const hours = (w.end.getTime() - w.start.getTime()) / 3600_000;
    expect(hours).toBe(7 * 24);
  });

  it("gains an hour in the week that contains the fall-back", () => {
    // Berlin falls back at 03:00 on Sunday 2026-10-25, which opens this week.
    const w = weekRange(new Date("2026-10-28T12:00:00Z"), TZ);
    expect(w.weekStart).toBe("2026-10-25");
    const hours = (w.end.getTime() - w.start.getTime()) / 3600_000;
    expect(hours).toBe(7 * 24 + 1);
  });

  it("loses an hour in the week that contains the spring-forward", () => {
    // Berlin springs forward at 02:00 on Sunday 2026-03-29.
    const w = weekRange(new Date("2026-04-01T12:00:00Z"), TZ);
    expect(w.weekStart).toBe("2026-03-29");
    const hours = (w.end.getTime() - w.start.getTime()) / 3600_000;
    expect(hours).toBe(7 * 24 - 1);
  });
});

describe("addMonths", () => {
  it("moves within a year", () => {
    expect(addMonths("2026-08", 1)).toBe("2026-09");
    expect(addMonths("2026-08", -1)).toBe("2026-07");
  });

  it("wraps across the year boundary in both directions", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("survives multi-year jumps", () => {
    expect(addMonths("2026-05", 25)).toBe("2028-06");
    expect(addMonths("2026-05", -25)).toBe("2024-04");
  });

  it("never overflows off a short month, unlike Date.setMonth", () => {
    // The trap this helper exists to avoid: a Date pinned to Jan 31 with
    // setMonth(+1) lands on Mar 3. Month strings carry no day to overflow.
    expect(addMonths("2026-01", 1)).toBe("2026-02");
    expect(addMonths("2026-03", -1)).toBe("2026-02");
  });
});

describe("daysInMonth", () => {
  it("knows the short months", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2026-04")).toBe(30);
    expect(daysInMonth("2026-08")).toBe(31);
  });

  it("handles a leap February", () => {
    expect(daysInMonth("2028-02")).toBe(29);
  });
});

describe("monthRange", () => {
  it("covers local midnight on the 1st to local midnight on the next 1st", () => {
    const r = monthRange(new Date("2026-07-15T09:00:00Z"), TZ);
    expect(r.month).toBe("2026-07");
    expect(r.start.toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-07-31T22:00:00.000Z");
  });

  it("reports the local month, not the UTC one", () => {
    // 22:30 UTC on Jul 31 is already 00:30 on Aug 1 in Berlin.
    const r = monthRange(new Date("2026-07-31T22:30:00Z"), TZ);
    expect(r.month).toBe("2026-08");
  });

  it("wraps December into the next January", () => {
    const r = monthRange(new Date("2026-12-15T12:00:00Z"), TZ);
    expect(r.month).toBe("2026-12");
    expect(r.end.toISOString()).toBe("2026-12-31T23:00:00.000Z"); // 2027-01-01 local
  });

  it("gives a 743-hour month across the spring-forward", () => {
    // Berlin springs forward on 2026-03-29: 31 days minus one hour.
    const r = monthRange(new Date("2026-03-15T12:00:00Z"), TZ);
    const hours = (r.end.getTime() - r.start.getTime()) / 3600_000;
    expect(hours).toBe(31 * 24 - 1);
  });

  it("gives a 745-hour month across the fall-back", () => {
    // Berlin falls back on 2026-10-25: 31 days plus one hour.
    const r = monthRange(new Date("2026-10-15T12:00:00Z"), TZ);
    const hours = (r.end.getTime() - r.start.getTime()) / 3600_000;
    expect(hours).toBe(31 * 24 + 1);
  });
});

describe("formatYmd", () => {
  it("renders a bare calendar day in Hebrew", () => {
    const s = formatYmd("2026-08-25", { day: "numeric", month: "long" });
    expect(s).toMatch(/[֐-׿]/); // contains a Hebrew character
    expect(s).toContain("25");
  });

  it("does not shift the day, whatever the machine's own timezone", () => {
    // The bug this guards: re-zoning a string that is already a local
    // calendar day moves it across midnight. The 1st must stay the 1st.
    expect(formatYmd("2026-08-01", { day: "numeric" })).toContain("1");
    expect(formatYmd("2026-08-31", { day: "numeric" })).toContain("31");
  });
});

describe("dayRange", () => {
  it("covers midnight to midnight local time", () => {
    const r = dayRange(new Date("2026-07-15T09:00:00Z"), TZ);
    expect(r.start.toISOString()).toBe("2026-07-14T22:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-07-15T22:00:00.000Z");
  });
});
