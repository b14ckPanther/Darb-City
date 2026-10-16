import { describe, expect, it } from "vitest";
import { formatKm, formatNumber, formatPhone, hasHours, hoursRows, weekdayNames } from "./format";

describe("numbers", () => {
  it("groups digits and writes Arabic with Latin digits", () => {
    expect(formatNumber(1234, "ar")).toBe("1,234");
    expect(formatNumber(1234, "he")).toBe("1,234");
  });
  it("writes distances with one decimal under 10 km", () => {
    expect(formatKm(9.76, "en")).toBe("9.8 km");
    expect(formatKm(23.4, "he")).toBe("23 ק״מ");
    expect(formatKm(3.21, "ar")).toBe("3.2 كم");
  });
});

describe("phones", () => {
  it("writes Israeli numbers the local way", () => {
    expect(formatPhone("+972501234567")).toBe("050-123-4567");
    expect(formatPhone("0501234567")).toBe("050-123-4567");
    expect(formatPhone("+97246012345")).toBe("04-601-2345");
  });
  it("leaves anything else alone", () => {
    expect(formatPhone("*2700")).toBe("*2700");
  });
});

describe("hours", () => {
  const hours = {
    weekly: { "0": [{ open: "09:00", close: "19:00" }], "5": [{ open: "09:00", close: "14:00" }] },
  };
  it("names the week from Sunday in each language", () => {
    expect(weekdayNames("en")[0]).toBe("Sunday");
    expect(weekdayNames("he")[6]).toBe("יום שבת");
    expect(weekdayNames("ar")[5]).toBe("الجمعة");
  });
  it("lists every day, closed days included, and marks today in Israel", () => {
    const rows = hoursRows(hours, "en", new Date("2026-10-16T08:00:00Z")); // Friday in Israel
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({
      name: "Sunday",
      text: "09:00-19:00",
      closed: false,
      today: false,
    });
    expect(rows[1]).toMatchObject({ text: "Closed", closed: true });
    expect(rows[5]).toMatchObject({ text: "09:00-14:00", today: true });
  });
  it("knows when there are no hours at all", () => {
    expect(hasHours({ weekly: {} })).toBe(false);
    expect(hasHours(hours)).toBe(true);
  });
});
