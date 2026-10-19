import type { HelperMomentsDto } from "@darb/contracts";
import { pickText, type Locale } from "@darb/core";
import { ht, type HelperKey } from "./copy";

/** The calendar day in Israel, as yyyy-mm-dd: "today" and "yesterday" are Israeli days. */
const dayOf = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

/** How long ago their last visit was, in days of Israel's calendar. */
export function daysBetween(since: string, now: string): number {
  return Math.round((Date.parse(dayOf(now)) - Date.parse(dayOf(since))) / 86_400_000);
}

const WENT_LIVE: Record<"one" | "many", [HelperKey, HelperKey, HelperKey]> = {
  one: ["wentLiveOneToday", "wentLiveOneYesterday", "wentLiveOneEarlier"],
  many: ["wentLiveToday", "wentLiveYesterday", "wentLiveEarlier"],
};

/** "3 of yours went live since yesterday": today, since yesterday, or since their last visit. */
export function wentLiveText(
  locale: Locale,
  wentLive: NonNullable<HelperMomentsDto["wentLive"]>,
  asOf: string,
): string {
  const days = daysBetween(wentLive.since, asOf);
  const keys = WENT_LIVE[wentLive.count === 1 ? "one" : "many"];
  return ht(locale, keys[Math.min(Math.max(days, 0), 2)]!, { count: wentLive.count });
}

export interface MilestoneView {
  count: number;
  /** The words under the number ("businesses you added"). */
  unit: string;
  /** Their busiest town, then how many are live (or that each one is checked first). */
  lines: string[];
}

/** The milestone's screen, worded truthfully: additions, and of them, those live now. */
export function milestoneView(
  locale: Locale,
  m: NonNullable<HelperMomentsDto["milestone"]>,
): MilestoneView {
  const town = m.placeName ? pickText(m.placeName, locale) : "";
  return {
    count: m.count,
    // Spoken Arabic counts 3 to 10 with the plural: 10 مصالح, but 50 مصلحة.
    unit: ht(locale, m.count <= 10 ? "milestoneUnitFew" : "milestoneUnit"),
    lines: [
      ...(town ? [ht(locale, "milestoneTown", { town })] : []),
      m.live > 0 ? ht(locale, "milestoneLive", { live: m.live }) : ht(locale, "milestoneWaiting"),
    ],
  };
}

/** Everything the home screen's moments need, as plain words for the client component. */
export interface MomentsView {
  asOf: string;
  note: string | null;
  milestone: MilestoneView | null;
}

export function momentsView(locale: Locale, dto: HelperMomentsDto): MomentsView {
  return {
    asOf: dto.asOf,
    note: dto.wentLive ? wentLiveText(locale, dto.wentLive, dto.asOf) : null,
    milestone: dto.milestone ? milestoneView(locale, dto.milestone) : null,
  };
}
