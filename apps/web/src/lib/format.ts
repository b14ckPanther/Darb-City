import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { INTL_TAG } from "./locale";

export function formatNumber(value: number, locale: Locale, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(INTL_TAG[locale], { maximumFractionDigits }).format(value);
}

export function formatKm(km: number, locale: Locale): string {
  return t(locale, "distanceKm", { km: formatNumber(km, locale, km < 10 ? 1 : 0) });
}

/** Israeli numbers in local form; anything else unchanged. Render inside `dir="ltr"`. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("972") ? `0${digits.slice(3)}` : digits;
  if (/^05\d{8}$/.test(local)) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  if (/^0[2-9]\d{7}$/.test(local))
    return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
  return phone;
}

export function weekdayNames(locale: Locale): string[] {
  const format = new Intl.DateTimeFormat(INTL_TAG[locale], { weekday: "long", timeZone: "UTC" });
  // 2026-10-11 is a Sunday.
  return [0, 1, 2, 3, 4, 5, 6].map((d) => format.format(new Date(Date.UTC(2026, 9, 11 + d))));
}

type WeeklyHours = { weekly: Partial<Record<string, { open: string; close: string }[]>> };

export interface HoursRow {
  day: number;
  name: string;
  /** "09:00-19:00, 20:00-23:00" (render inside dir="ltr") or the localized "Closed". */
  text: string;
  closed: boolean;
  today: boolean;
}

const ISRAEL_WEEKDAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jerusalem",
  weekday: "short",
});
const DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function hoursRows(hours: WeeklyHours, locale: Locale, at: Date = new Date()): HoursRow[] {
  const today = DAY_INDEX[ISRAEL_WEEKDAY.format(at)];
  return weekdayNames(locale).map((name, day) => {
    const intervals = hours.weekly[String(day)] ?? [];
    const closed = intervals.length === 0;
    return {
      day,
      name,
      closed,
      today: day === today,
      text: closed ? t(locale, "closed") : intervals.map((i) => `${i.open}-${i.close}`).join(", "),
    };
  });
}

export function hasHours(hours: WeeklyHours): boolean {
  return Object.values(hours.weekly).some((intervals) => (intervals?.length ?? 0) > 0);
}
