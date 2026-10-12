import type { Hours } from "@darb/core";
import { expect, it } from "vitest";
import { toArabDruzeWeek, toChristianWeek } from "./showroom.js";

const booking: Hours = {
  weekly: {
    0: [{ open: "09:00", close: "19:00" }],
    4: [{ open: "09:00", close: "19:00" }],
    5: [{ open: "09:00", close: "14:00" }],
  },
  exceptions: [],
};

it("opens Saturday like Sunday and closes Friday at noon", () => {
  const week = toArabDruzeWeek(booking);
  expect(week.weekly[6]).toEqual([{ open: "09:00", close: "19:00" }]);
  expect(week.weekly[5]).toEqual([{ open: "09:00", close: "12:00" }]);
  expect(week.weekly[4]).toEqual(booking.weekly[4]);
});

it("closes Friday when Sunday opens after noon, and leaves an empty week alone", () => {
  const late: Hours = { weekly: { 0: [{ open: "14:00", close: "22:00" }] }, exceptions: [] };
  expect(toArabDruzeWeek(late).weekly[5]).toEqual([]);
  const none: Hours = { weekly: {}, exceptions: [] };
  expect(toArabDruzeWeek(none)).toEqual(none);
});

it("Christian villages: Saturday takes Sunday's hours, Sunday closed, Friday unchanged", () => {
  const week = toChristianWeek(booking);
  expect(week.weekly[0]).toEqual([]);
  expect(week.weekly[5]).toEqual(booking.weekly[5]);
  expect(week.weekly[6]).toEqual([{ open: "09:00", close: "19:00" }]);
  expect(week.weekly[4]).toEqual(booking.weekly[4]);
  const none: Hours = { weekly: {}, exceptions: [] };
  expect(toChristianWeek(none)).toEqual(none);
});
