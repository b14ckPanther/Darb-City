import {
  intervalsFor,
  isOpenAt,
  local,
  previousDate,
  type Hours,
  type Interval,
  type Weekday,
} from "@darb/core";

const DAY = 24 * 60;
const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

function nextDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * The intervals around a moment, Israel time, exceptions applied: yesterday's (for a shift past
 * midnight), today's and tomorrow's, with the minutes since midnight.
 */
export function daysAround(
  hours: Hours,
  at: Date,
): { minutes: number; yesterday: Interval[]; today: Interval[]; tomorrow: Interval[] } {
  const now = local(at);
  return {
    minutes: now.minutes,
    yesterday: intervalsFor(hours, previousDate(now.date), ((now.weekday + 6) % 7) as Weekday),
    today: intervalsFor(hours, now.date, now.weekday),
    tomorrow: intervalsFor(hours, nextDate(now.date), ((now.weekday + 1) % 7) as Weekday),
  };
}

/** What a business card says about today: open until when, or when it opens next. */
export interface DayPlan {
  open: boolean;
  /** Minutes since local midnight, Israel time. */
  minutes: number;
  /** Today's open spans in minutes (0 to 1440), last night's overnight tail included. */
  spans: [number, number][];
  /** While open: the closing time ("HH:MM"); null when today is open around the clock. */
  closesAt: string | null;
  /** While closed: the next opening, later today or tomorrow; null when neither has one. */
  opensAt: { time: string; day: "today" | "tomorrow" } | null;
}

/**
 * Today at a glance, from the same hours, exceptions and open-now rule (core's isOpenAt) as the
 * API. Here rather than in @darb/core, which ships in several browser chunks: only the card's
 * today needs it.
 */
export function dayPlan(hours: Hours, at: Date): DayPlan {
  const { minutes, yesterday, today, tomorrow } = daysAround(hours, at);
  const spans: [number, number][] = [];
  let closesAt: string | null = null;
  for (const { open, close } of yesterday) {
    const c = toMinutes(close);
    if (c <= toMinutes(open) && c > 0) {
      spans.push([0, c]);
      if (minutes < c) closesAt = close;
    }
  }
  for (const { open, close } of today) {
    const o = toMinutes(open);
    const c = toMinutes(close);
    const end = c > o ? c : DAY;
    spans.push([o, end]);
    if (minutes >= o && minutes < end) closesAt = close;
  }
  spans.sort((a, b) => a[0] - b[0]);
  const open = isOpenAt(hours, at);
  // Spans that touch from midnight to midnight: nothing closes today.
  let reach = 0;
  for (const [s, e] of spans) if (s <= reach) reach = Math.max(reach, e);
  if (reach >= DAY) closesAt = null;
  const first = (list: { open: string }[]) => list.map((i) => i.open).sort()[0];
  const later = first(today.filter((i) => toMinutes(i.open) > minutes));
  const next = first(tomorrow);
  return {
    open,
    minutes,
    spans,
    closesAt: open ? closesAt : null,
    opensAt: open
      ? null
      : later
        ? { time: later, day: "today" }
        : next
          ? { time: next, day: "tomorrow" }
          : null,
  };
}
