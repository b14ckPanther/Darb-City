import { describe, expect, it } from "vitest";
import type { Hours } from "@darb/core";
import { dayPlan } from "./day-plan";

const at = (iso: string) => new Date(iso);

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
