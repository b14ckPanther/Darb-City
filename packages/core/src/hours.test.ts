import { describe, expect, it } from "vitest";
import { dayPlan, isByAppointment, isOpenAt, type Hours } from "./hours.js";

const at = (iso: string) => new Date(iso);
const weekdays: Hours = { weekly: { 1: [{ open: "09:00", close: "17:00" }] }, exceptions: [] };

describe("isOpenAt", () => {
  it("is open inside a same-day interval", () => {
    expect(isOpenAt(weekdays, at("2026-10-12T06:30:00Z"))).toBe(true); // Mon 09:30
  });
  it("is closed before opening and exactly at closing", () => {
    expect(isOpenAt(weekdays, at("2026-10-12T05:30:00Z"))).toBe(false); // Mon 08:30
    expect(isOpenAt(weekdays, at("2026-10-12T14:00:00Z"))).toBe(false); // Mon 17:00
  });
  it("uses winter time after daylight saving ends", () => {
    expect(isOpenAt(weekdays, at("2026-12-14T07:30:00Z"))).toBe(true); // Mon 09:30 (UTC+2)
  });

  const friNight: Hours = { weekly: { 5: [{ open: "20:00", close: "02:00" }] }, exceptions: [] };
  it("carries an overnight interval into the next morning", () => {
    expect(isOpenAt(friNight, at("2026-10-16T22:30:00Z"))).toBe(true); // Sat 01:30
    expect(isOpenAt(friNight, at("2026-10-16T23:30:00Z"))).toBe(false); // Sat 02:30
  });
  it("lets an exception on the previous day cancel the overnight tail", () => {
    const closedFriday: Hours = {
      ...friNight,
      exceptions: [{ date: "2026-10-16", intervals: [] }],
    };
    expect(isOpenAt(closedFriday, at("2026-10-16T22:30:00Z"))).toBe(false); // Sat 01:30
  });
  it("lets an exception close a normal day", () => {
    const holiday: Hours = { ...weekdays, exceptions: [{ date: "2026-10-12", intervals: [] }] };
    expect(isOpenAt(holiday, at("2026-10-12T06:30:00Z"))).toBe(false);
  });
  it("lets an exception open a normally closed day", () => {
    const special: Hours = {
      weekly: {},
      exceptions: [{ date: "2026-10-12", intervals: [{ open: "09:00", close: "12:00" }] }],
    };
    expect(isOpenAt(special, at("2026-10-12T06:30:00Z"))).toBe(true);
  });
  it("handles the night daylight saving ends", () => {
    const satNight: Hours = { weekly: { 6: [{ open: "21:00", close: "03:00" }] }, exceptions: [] };
    expect(isOpenAt(satNight, at("2026-10-24T22:30:00Z"))).toBe(true); // Sun 01:30
  });
  it("treats 24:00 as the end of the day", () => {
    const lateSat: Hours = { weekly: { 6: [{ open: "18:00", close: "24:00" }] }, exceptions: [] };
    expect(isOpenAt(lateSat, at("2026-10-17T20:59:00Z"))).toBe(true); // Sat 23:59
  });
});

describe("by appointment (Task 28)", () => {
  it("is never open now, whatever hours it also lists", () => {
    const appointment: Hours = { weekly: {}, exceptions: [], byAppointment: true };
    expect(isOpenAt(appointment, new Date("2026-10-12T06:30:00Z"))).toBe(false);
    const withHours: Hours = {
      weekly: { 1: [{ open: "00:00", close: "24:00" }] },
      exceptions: [],
      byAppointment: true,
    };
    expect(isOpenAt(withHours, new Date("2026-10-12T06:30:00Z"))).toBe(false);
    expect(isByAppointment(appointment)).toBe(true);
    const plain: Hours = { weekly: {}, exceptions: [] };
    expect(isByAppointment(plain)).toBe(false);
  });
});

describe("dayPlan", () => {
  const split: Hours = {
    weekly: {
      1: [
        { open: "09:00", close: "13:00" },
        { open: "16:00", close: "22:00" },
      ],
      2: [{ open: "08:00", close: "12:00" }],
    },
    exceptions: [],
  };
  it("says when an open business closes, with today's spans", () => {
    const plan = dayPlan(split, at("2026-10-12T07:00:00Z")); // Mon 10:00
    expect(plan).toMatchObject({ open: true, closesAt: "13:00", opensAt: null, minutes: 600 });
    expect(plan.spans).toEqual([
      [540, 780],
      [960, 1320],
    ]);
  });
  it("says when it opens again later today, between shifts", () => {
    const plan = dayPlan(split, at("2026-10-12T11:00:00Z")); // Mon 14:00
    expect(plan).toMatchObject({
      open: false,
      closesAt: null,
      opensAt: { time: "16:00", day: "today" },
    });
  });
  it("looks to tomorrow once today is over, and says nothing when tomorrow is closed", () => {
    expect(dayPlan(split, at("2026-10-12T20:00:00Z")).opensAt).toEqual({
      time: "08:00",
      day: "tomorrow",
    }); // Mon 23:00
    expect(dayPlan(split, at("2026-10-13T10:00:00Z")).opensAt).toBeNull(); // Tue 13:00
  });
  it("counts last night's tail as open this morning", () => {
    const friNight: Hours = { weekly: { 5: [{ open: "20:00", close: "02:00" }] }, exceptions: [] };
    const plan = dayPlan(friNight, at("2026-10-16T22:30:00Z")); // Sat 01:30
    expect(plan).toMatchObject({ open: true, closesAt: "02:00", spans: [[0, 120]] });
  });
  it("never names a closing time for a business open around the clock", () => {
    const allDay: Hours = { weekly: { 1: [{ open: "00:00", close: "24:00" }] }, exceptions: [] };
    expect(dayPlan(allDay, at("2026-10-12T07:00:00Z"))).toMatchObject({
      open: true,
      closesAt: null,
      spans: [[0, 1440]],
    });
  });
  it("is never open by appointment", () => {
    const plan = dayPlan({ ...split, byAppointment: true }, at("2026-10-12T07:00:00Z"));
    expect(plan.open).toBe(false);
  });
});
