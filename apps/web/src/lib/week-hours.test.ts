import { describe, expect, it } from "vitest";
import {
  badDays,
  copyToAll,
  emptyWeek,
  openNow,
  presetWeek,
  weekFromHours,
  weekToHours,
} from "./week-hours";

describe("the week editor", () => {
  it("fills the usual week: Sunday to Thursday, a short Friday, Saturday closed", () => {
    expect(weekToHours(presetWeek("sunThu"))).toEqual({
      weekly: {
        0: [{ open: "09:00", close: "18:00" }],
        1: [{ open: "09:00", close: "18:00" }],
        2: [{ open: "09:00", close: "18:00" }],
        3: [{ open: "09:00", close: "18:00" }],
        4: [{ open: "09:00", close: "18:00" }],
        5: [{ open: "09:00", close: "14:00" }],
      },
      exceptions: [],
    });
    expect(Object.keys(weekToHours(presetWeek("everyDay")).weekly)).toHaveLength(7);
    expect(weekToHours(presetWeek("allDay")).weekly[3]).toEqual([
      { open: "00:00", close: "24:00" },
    ]);
  });

  it("leaves closed days out, and an empty week has nothing to say", () => {
    expect(weekToHours(emptyWeek())).toEqual({ weekly: {}, exceptions: [] });
    expect(openNow(emptyWeek())).toBeNull();
  });

  it("copies one day to all", () => {
    const week = emptyWeek();
    week[2] = { open: true, from: "10:00", to: "22:00" };
    expect(copyToAll(week, 2).every((d) => d.open && d.from === "10:00")).toBe(true);
  });

  it("reads hours back, first interval of each day, ignoring broken times", () => {
    const week = weekFromHours({
      weekly: {
        1: [
          { open: "08:00", close: "12:00" },
          { open: "16:00", close: "20:00" },
        ],
        2: [{ open: "8am", close: "noon" }],
      },
    });
    expect(week[1]).toEqual({ open: true, from: "08:00", to: "12:00" });
    expect(week[2]!.open).toBe(false);
  });

  it("flags open days without usable times", () => {
    const week = emptyWeek();
    week[4] = { open: true, from: "", to: "18:00" };
    expect(badDays(week)).toEqual([4]);
    expect(weekToHours(week).weekly).toEqual({});
  });

  it("knows whether it is open now, Israel time", () => {
    const week = presetWeek("sunThu");
    // Sunday 18 October 2026, 10:00 in Israel (07:00 UTC).
    expect(openNow(week, new Date("2026-10-18T07:00:00Z"))).toBe(true);
    // Saturday.
    expect(openNow(week, new Date("2026-10-17T10:00:00Z"))).toBe(false);
  });
});
