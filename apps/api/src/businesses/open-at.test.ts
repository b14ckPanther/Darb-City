import { isOpenAt, type Hours } from "@darb/core";
import { afterAll, describe, expect, it } from "vitest";
import { testPrisma } from "../../test/db.js";

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

const SAMPLES: Record<string, Hours> = {
  plain: {
    weekly: { 0: [{ open: "09:00", close: "19:00" }], 5: [{ open: "08:00", close: "12:00" }] },
    exceptions: [],
  },
  split: {
    weekly: {
      1: [
        { open: "08:00", close: "12:00" },
        { open: "16:00", close: "20:00" },
      ],
    },
    exceptions: [],
  },
  overnight: {
    weekly: { 4: [{ open: "18:00", close: "02:00" }], 6: [{ open: "20:00", close: "03:30" }] },
    exceptions: [],
  },
  midnight: { weekly: { 2: [{ open: "10:00", close: "24:00" }] }, exceptions: [] },
  allDay: { weekly: { 3: [{ open: "00:00", close: "24:00" }] }, exceptions: [] },
  closedHoliday: {
    weekly: { 0: [{ open: "09:00", close: "19:00" }] },
    exceptions: [{ date: "2026-10-11", intervals: [] }],
  },
  ramadan: {
    weekly: { 1: [{ open: "09:00", close: "17:00" }] },
    exceptions: [{ date: "2026-10-12", intervals: [{ open: "20:00", close: "01:00" }] }],
  },
  empty: { weekly: {}, exceptions: [] },
  // Task 28: by appointment is never open now, even with hours listed.
  appointment: {
    weekly: { 3: [{ open: "00:00", close: "24:00" }] },
    exceptions: [],
    byAppointment: true,
  },
};

/** Every 30 minutes across a week that crosses the end of daylight saving time (2026-10-25). */
const MOMENTS = Array.from(
  { length: 2 * 24 * 16 },
  (_, i) => new Date(Date.UTC(2026, 9, 10, 0, 30 * i)),
);

describe("darb_open_at", () => {
  for (const [name, hours] of Object.entries(SAMPLES)) {
    it(`agrees with isOpenAt: ${name}`, async () => {
      const rows = await prisma.$queryRaw<{ at: Date; open: boolean }[]>`
        SELECT m.at, darb_open_at(${JSON.stringify(hours)}::jsonb, m.at) AS open
        FROM unnest(${MOMENTS}::timestamptz[]) AS m(at)`;
      const wrong = rows
        .filter((r) => r.open !== isOpenAt(hours, r.at))
        .map((r) => r.at.toISOString());
      expect(wrong).toEqual([]);
    });
  }
});
