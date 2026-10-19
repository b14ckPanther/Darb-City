import { expect, it } from "vitest";
import { daysBetween, milestoneView, momentsView, wentLiveText } from "./moment-view";

const NOW = "2026-10-19T09:00:00.000Z"; // noon in Israel

it("counts days on Israel's calendar", () => {
  expect(daysBetween("2026-10-19T05:00:00.000Z", NOW)).toBe(0);
  // 23:30 on the 18th in Israel is yesterday, though under 10 hours ago.
  expect(daysBetween("2026-10-18T20:30:00.000Z", NOW)).toBe(1);
  // 00:30 on the 19th in Israel is today, though the 18th in UTC.
  expect(daysBetween("2026-10-18T21:30:00.000Z", NOW)).toBe(0);
  expect(daysBetween("2026-10-12T09:00:00.000Z", NOW)).toBe(7);
});

it("says what went live: today, since yesterday, or since the last visit, one or many", () => {
  const at = (count: number, since: string) => wentLiveText("en", { count, since }, NOW);
  expect(at(3, "2026-10-19T05:00:00.000Z")).toBe("3 of yours went live today.");
  expect(at(3, "2026-10-18T09:00:00.000Z")).toBe("3 of yours went live since yesterday.");
  expect(at(3, "2026-10-10T09:00:00.000Z")).toBe("3 of yours went live since your last visit.");
  expect(at(1, "2026-10-18T09:00:00.000Z")).toBe("One of yours went live since yesterday.");
  expect(wentLiveText("he", { count: 3, since: "2026-10-18T09:00:00.000Z" }, NOW)).toBe(
    "3 מהעסקים שהוספת עלו לאוויר מאתמול.",
  );
  expect(wentLiveText("ar", { count: 3, since: "2026-10-18T09:00:00.000Z" }, NOW)).toBe(
    "3 من اللي ضفتهم طلعوا على درب من مبارح.",
  );
});

it("words a milestone truthfully: additions, the busiest town, and how many are live", () => {
  const sakhnin = { he: "סח'נין", ar: "سخنين", en: "Sakhnin" };
  expect(milestoneView("en", { count: 100, live: 72, placeName: sakhnin })).toEqual({
    count: 100,
    unit: "businesses you added",
    lines: ["The most in Sakhnin.", "72 of them are on the map because of you."],
  });
  // None live yet: never claims they are on the map.
  expect(milestoneView("en", { count: 10, live: 0, placeName: null }).lines).toEqual([
    "An admin checks each one, then it goes on the map.",
  ]);
  expect(milestoneView("he", { count: 50, live: 3, placeName: sakhnin }).lines[0]).toBe(
    "הכי הרבה בסח'נין.",
  );
  // Spoken Arabic: 10 مصالح, 50 مصلحة.
  expect(milestoneView("ar", { count: 10, live: 0, placeName: null }).unit).toBe("مصالح ضفتها");
  expect(milestoneView("ar", { count: 50, live: 0, placeName: null }).unit).toBe("مصلحة ضفتها");
});

it("has nothing to say when nothing happened", () => {
  expect(momentsView("en", { asOf: NOW, milestone: null, wentLive: null })).toEqual({
    asOf: NOW,
    note: null,
    milestone: null,
  });
});
