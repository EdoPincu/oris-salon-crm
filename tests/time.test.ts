import { describe, expect, it } from "vitest";
import {
  zonedStartOfDay,
  ymdInZone,
  addDays,
  weekRange,
  dayRange,
} from "@/lib/time";

const TZ = "Europe/Berlin";

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
  it("starts weeks on Monday", () => {
    // 2026-07-15 is a Wednesday.
    const w = weekRange(new Date("2026-07-15T12:00:00Z"), TZ);
    expect(w.monday).toBe("2026-07-13");
  });

  it("treats Sunday as the end of the week, not the start", () => {
    // 2026-07-19 is a Sunday.
    const w = weekRange(new Date("2026-07-19T12:00:00Z"), TZ);
    expect(w.monday).toBe("2026-07-13");
  });

  it("spans exactly seven local days", () => {
    const w = weekRange(new Date("2026-10-21T12:00:00Z"), TZ); // week contains DST change
    const hours = (w.end.getTime() - w.start.getTime()) / 3600_000;
    expect(hours).toBe(7 * 24 + 1); // one extra hour from falling back
  });
});

describe("dayRange", () => {
  it("covers midnight to midnight local time", () => {
    const r = dayRange(new Date("2026-07-15T09:00:00Z"), TZ);
    expect(r.start.toISOString()).toBe("2026-07-14T22:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-07-15T22:00:00.000Z");
  });
});
