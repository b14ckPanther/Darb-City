import { isOpenAt, type Hours, type Interval, type Weekday } from "@darb/core";

/** One day of the /join week editor: open or not, one opening and one closing time. */
export interface DayRow {
  open: boolean;
  from: string;
  to: string;
}
/** Sunday (0) to Saturday (6), as the contracts' Hours count them. */
export type Week = DayRow[];

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const closed = (): DayRow => ({ open: false, from: "09:00", to: "18:00" });

export const emptyWeek = (): Week => Array.from({ length: 7 }, closed);

export type Preset = "sunThu" | "everyDay" | "allDay";

/** The quick fills: a usual week (Friday short, Saturday closed), every day, or day and night. */
export function presetWeek(preset: Preset): Week {
  return Array.from({ length: 7 }, (_, day): DayRow => {
    if (preset === "allDay") return { open: true, from: "00:00", to: "24:00" };
    if (preset === "everyDay") return { open: true, from: "09:00", to: "18:00" };
    if (day <= 4) return { open: true, from: "09:00", to: "18:00" };
    return day === 5 ? { open: true, from: "09:00", to: "14:00" } : closed();
  });
}

/** Every day takes the chosen day's row. */
export const copyToAll = (week: Week, day: number): Week => week.map(() => ({ ...week[day]! }));

/** A lookup's (or a saved business's) weekly hours as rows: the first interval of each day. */
export function weekFromHours(hours: Pick<Hours, "weekly"> | undefined): Week {
  return emptyWeek().map((row, day) => {
    const first = hours?.weekly[day as Weekday]?.[0];
    return first && TIME.test(first.open) && TIME.test(first.close)
      ? { open: true, from: first.open, to: first.close }
      : row;
  });
}

/** A day that is open but has no usable times; such a week cannot be sent. */
export const badDays = (week: Week): number[] =>
  week.flatMap((d, i) => (d.open && (!TIME.test(d.from) || !TIME.test(d.to)) ? [i] : []));

/** The contracts' Hours: open days only (closed days are absent, as the seed writes them). */
export function weekToHours(week: Week): Hours {
  const weekly: Partial<Record<Weekday, Interval[]>> = {};
  week.forEach((d, i) => {
    if (d.open && TIME.test(d.from) && TIME.test(d.to))
      weekly[i as Weekday] = [{ open: d.from, close: d.to }];
  });
  return { weekly, exceptions: [] };
}

/** Open at that moment, Israel time; null when no day is open (nothing to say). */
export function openNow(week: Week, at: Date = new Date()): boolean | null {
  const hours = weekToHours(week);
  return Object.keys(hours.weekly).length ? isOpenAt(hours, at) : null;
}
