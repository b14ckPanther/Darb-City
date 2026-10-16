import { describe, expect, it } from "vitest";
import { daysAround, isByAppointment, isOpenAt, type Hours } from "./hours.js";

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

describe("daysAround", () => {
  it("gives yesterday's, today's and tomorrow's intervals, exceptions applied", () => {
    const hours: Hours = {
      weekly: {
        0: [{ open: "20:00", close: "02:00" }],
        1: [{ open: "09:00", close: "17:00" }],
        2: [{ open: "08:00", close: "12:00" }],
      },
      exceptions: [{ date: "2026-10-13", intervals: [] }],
    };
    expect(daysAround(hours, at("2026-10-12T07:00:00Z"))).toEqual({
      minutes: 600, // Mon 10:00
      yesterday: [{ open: "20:00", close: "02:00" }],
      today: [{ open: "09:00", close: "17:00" }],
      tomorrow: [],
    });
  });
});
