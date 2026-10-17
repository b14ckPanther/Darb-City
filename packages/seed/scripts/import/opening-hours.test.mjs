import { describe, expect, it } from "vitest";
import { parseOpeningHours as parse } from "./opening-hours.mjs";

const iv = (open, close) => [{ open, close }];

describe("opening_hours", () => {
  it("reads 24/7 and a whole day every day", () => {
    for (const raw of ["24/7", "00:00-24:00", "Mo-Su 00:00-24:00"]) {
      const h = parse(raw);
      expect(Object.keys(h.weekly), raw).toHaveLength(7);
      expect(h.weekly["5"]).toEqual(iv("00:00", "24:00"));
    }
  });
  it("reads weekday ranges with a day off (Sunday is 0)", () => {
    expect(parse("Mo-Fr 09:00-18:00; Sa off")).toEqual({
      weekly: {
        1: iv("09:00", "18:00"),
        2: iv("09:00", "18:00"),
        3: iv("09:00", "18:00"),
        4: iv("09:00", "18:00"),
        5: iv("09:00", "18:00"),
      },
      exceptions: [],
    });
  });
  it("reads the Israeli week, by semicolons or by commas", () => {
    for (const raw of [
      "Su-Th 08:00-22:00; Fr 08:00-14:00",
      "Su-Th 08:00-22:00, Fr 08:00-14:00",
      "Su-Th 08:00-22:00;Fr 08:00-14:00;",
    ]) {
      const h = parse(raw);
      expect(h.weekly["0"], raw).toEqual(iv("08:00", "22:00"));
      expect(h.weekly["4"], raw).toEqual(iv("08:00", "22:00"));
      expect(h.weekly["5"], raw).toEqual(iv("08:00", "14:00"));
      expect(h.weekly["6"], raw).toBeUndefined();
    }
  });
  it("reads day lists, including one split by a comma before its times", () => {
    const h = parse("Mo-Th, Su 11:00-22:30; Fr 11:00-16:00; Sa 20:20-22:30");
    expect(h.weekly["0"]).toEqual(iv("11:00", "22:30"));
    expect(h.weekly["1"]).toEqual(iv("11:00", "22:30"));
    expect(h.weekly["5"]).toEqual(iv("11:00", "16:00"));
    expect(h.weekly["6"]).toEqual(iv("20:20", "22:30"));
    const g = parse("We,Th,Su 11:00-22:00; Fr,Sa 10:30-22:00; Mo,Tu 11:00-21:00");
    expect(Object.keys(g.weekly)).toHaveLength(7);
    expect(g.weekly["2"]).toEqual(iv("11:00", "21:00"));
  });
  it("reads ranges across the week's end and several ranges a day", () => {
    const h = parse("Sa-Th 12:00-23:00; Fr 12:00-17:00");
    expect(h.weekly["6"]).toEqual(iv("12:00", "23:00"));
    expect(h.weekly["0"]).toEqual(iv("12:00", "23:00"));
    expect(h.weekly["5"]).toEqual(iv("12:00", "17:00"));
    expect(parse("Su-Th 08:00-12:00,16:00-20:00").weekly["2"]).toEqual([
      { open: "08:00", close: "12:00" },
      { open: "16:00", close: "20:00" },
    ]);
  });
  it("reads times alone as every day, single-digit hours, spaced dashes and late closes", () => {
    expect(Object.keys(parse("10:00-22:00").weekly)).toHaveLength(7);
    expect(parse("Su-Th 9:30-24:00").weekly["0"]).toEqual(iv("09:30", "24:00"));
    expect(parse("12:00 - 15:00").weekly["3"]).toEqual(iv("12:00", "15:00"));
    expect(parse("Mo-Su 12:00-00:00").weekly["1"]).toEqual(iv("12:00", "24:00"));
    expect(parse("Mo-Su 16:00-04:00").weekly["1"]).toEqual(iv("16:00", "04:00"));
    expect(parse("Mo-Su 10:00-22:00+").weekly["1"]).toEqual(iv("10:00", "22:00"));
  });
  it("lets a later rule override an earlier one, and ignores holiday rules", () => {
    const h = parse("Mo-Su 14:00-24:00; Fr off; Sa 18:00-24:00; PH off");
    expect(h.weekly["5"]).toBeUndefined();
    expect(h.weekly["6"]).toEqual(iv("18:00", "24:00"));
    expect(h.weekly["0"]).toEqual(iv("14:00", "24:00"));
    expect(parse("Mo-Fr,Su 09:00-18:30; PH closed").weekly["0"]).toEqual(iv("09:00", "18:30"));
  });
  it("reads rules with a missing separator and a holiday in a day list", () => {
    const h = parse("Su-Th 11:00-00:00 Fr 11:00-14:30 Sa 21:00-00:00");
    expect(h.weekly["5"]).toEqual(iv("11:00", "14:30"));
    expect(h.weekly["6"]).toEqual(iv("21:00", "24:00"));
    expect(Object.keys(parse("PH,Mo-Su 09:00-22:50;").weekly)).toHaveLength(7);
  });
  it("gives null for what it cannot say for sure", () => {
    for (const raw of [
      "",
      "8:00 14:00",
      "Si-Sa 12:00-23:00",
      "Sunday-Friday ??-23:00",
      "Mo-Su 12:00+",
      "Su-Th 08:30-22:45; Fr 08:30-(sunset-00:30)",
      'Su-Th 11:00-00:00, Fr, Sa unknown "please inquire"',
      "Mo-Su 12:00-21:00, Jun 21-Sep 21 Mo-Su 12:00-23:00",
      "12:00-22:00; 12:00-22:30",
      "Su-Fr 8:00-23:00, Saturday 9:30-23:00",
      "Sa off",
      "PH off",
      undefined,
    ])
      expect(parse(raw), String(raw)).toBeNull();
  });
});
