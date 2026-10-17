import { describe, expect, it } from "vitest";
import { parseDays, parseOpeningHours } from "./oh.mjs";

const day = (open, close) => [{ open, close }];

describe("opening_hours to Darb hours", () => {
  it("reads 24/7 as every day all day", () => {
    const h = parseOpeningHours("24/7");
    expect(Object.keys(h.weekly)).toHaveLength(7);
    expect(h.weekly["3"]).toEqual(day("00:00", "24:00"));
    expect(h.exceptions).toEqual([]);
  });
  it("reads the Israeli week with a short Friday and Saturday off", () => {
    const h = parseOpeningHours("Su-Th 08:00-19:00; Fr 08:00-14:00; Sa off");
    expect(h.weekly["0"]).toEqual(day("08:00", "19:00"));
    expect(h.weekly["4"]).toEqual(day("08:00", "19:00"));
    expect(h.weekly["5"]).toEqual(day("08:00", "14:00"));
    expect(h.weekly["6"]).toBeUndefined();
  });
  it("reads split days, single days and lists of days", () => {
    const h = parseOpeningHours("Mo-Fr 09:00-13:00,16:00-19:00; Su,Sa 10:00-12:00");
    expect(h.weekly["1"]).toEqual([
      { open: "09:00", close: "13:00" },
      { open: "16:00", close: "19:00" },
    ]);
    expect(h.weekly["0"]).toEqual(day("10:00", "12:00"));
    expect(h.weekly["6"]).toEqual(day("10:00", "12:00"));
  });
  it("reads times with no days as every day, and a comma between rules", () => {
    expect(Object.keys(parseOpeningHours("08:00-20:00").weekly)).toHaveLength(7);
    const h = parseOpeningHours("Mo-Th 08:00-12:00, Fr 09:00-11:00");
    expect(h.weekly["5"]).toEqual(day("09:00", "11:00"));
    expect(h.weekly["2"]).toEqual(day("08:00", "12:00"));
  });
  it("lets later rules replace earlier ones and keeps past-midnight closes", () => {
    const h = parseOpeningHours("Mo-Su 10:00-02:00; Sa 20:00-00:00; Fr off");
    expect(h.weekly["1"]).toEqual(day("10:00", "02:00"));
    expect(h.weekly["6"]).toEqual(day("20:00", "24:00"));
    expect(h.weekly["5"]).toBeUndefined();
  });
  it("drops public holiday rules and pads single-digit hours", () => {
    const h = parseOpeningHours("Su-Th 8:00-17:00; PH off");
    expect(h.weekly["0"]).toEqual(day("08:00", "17:00"));
  });
  it("wraps day ranges across the week's end", () => {
    expect(parseDays("Fr-Mo")).toEqual([5, 6, 0, 1]);
  });
  it("gives null for what it cannot read for certain", () => {
    for (const raw of [
      "",
      null,
      "sunrise-sunset",
      "Mo-Fr 08:00+",
      'Mo-Fr 08:00-17:00 "by appointment"',
      "Jan-Mar Mo-Fr 08:00-12:00",
      "Mo-Fr",
      "Sa off",
      "08:00-25:00",
      "by appointment",
    ])
      expect(parseOpeningHours(raw), String(raw)).toBeNull();
  });
});
