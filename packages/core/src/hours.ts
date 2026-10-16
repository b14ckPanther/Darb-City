export const TIME_ZONE = "Asia/Jerusalem";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** "HH:MM" local times. `close` may be "24:00"; `close <= open` runs past midnight. */
export interface Interval {
  open: string;
  close: string;
}

export interface Hours {
  weekly: Partial<Record<Weekday, Interval[]>>;
  /** Dated overrides (`YYYY-MM-DD`, Israel local). Empty `intervals` means closed all day. */
  exceptions: { date: string; intervals: Interval[] }[];
  /**
   * Visits by arrangement only (a home business, Task 28): never "open now", and pages say
   * "By appointment" instead of an open or closed badge.
   */
  byAppointment?: boolean;
}

export function isByAppointment(hours: { byAppointment?: boolean }): boolean {
  return hours.byAppointment === true;
}

const WEEKDAYS: Record<string, Weekday> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

interface LocalMoment {
  date: string;
  weekday: Weekday;
  minutes: number;
}

function local(at: Date): LocalMoment {
  const parts = Object.fromEntries(formatter.formatToParts(at).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAYS[parts.weekday as string] as Weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function previousDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

function intervalsFor(hours: Hours, date: string, weekday: Weekday): Interval[] {
  const exception = hours.exceptions.find((e) => e.date === date);
  return exception ? exception.intervals : (hours.weekly[weekday] ?? []);
}

export function isOpenAt(hours: Hours, at: Date): boolean {
  if (isByAppointment(hours)) return false;
  const now = local(at);
  for (const { open, close } of intervalsFor(hours, now.date, now.weekday)) {
    const o = toMinutes(open);
    const c = toMinutes(close);
    if (c > o ? now.minutes >= o && now.minutes < c : now.minutes >= o) return true;
  }
  const yesterday = ((now.weekday + 6) % 7) as Weekday;
  for (const { open, close } of intervalsFor(hours, previousDate(now.date), yesterday)) {
    const o = toMinutes(open);
    const c = toMinutes(close);
    if (c <= o && now.minutes < c) return true;
  }
  return false;
}

function nextDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

const DAY = 24 * 60;

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

/** Today at a glance, from the same weekly hours and exceptions as isOpenAt. */
export function dayPlan(hours: Hours, at: Date): DayPlan {
  const now = local(at);
  const yesterday = ((now.weekday + 6) % 7) as Weekday;
  const today = intervalsFor(hours, now.date, now.weekday);
  const spans: [number, number][] = [];
  let closesAt: string | null = null;
  for (const { close, open } of intervalsFor(hours, previousDate(now.date), yesterday)) {
    const c = toMinutes(close);
    if (c <= toMinutes(open) && c > 0) {
      spans.push([0, c]);
      if (now.minutes < c) closesAt = close;
    }
  }
  for (const { open, close } of today) {
    const o = toMinutes(open);
    const c = toMinutes(close);
    const end = c > o ? c : DAY;
    spans.push([o, end]);
    if (now.minutes >= o && now.minutes < end) closesAt = close;
  }
  spans.sort((a, b) => a[0] - b[0]);
  const open = !isByAppointment(hours) && isOpenAt(hours, at);
  // Spans that touch from midnight to midnight: nothing closes today.
  let reach = 0;
  for (const [s, e] of spans) if (s <= reach) reach = Math.max(reach, e);
  if (open && reach >= DAY) closesAt = null;
  let opensAt: DayPlan["opensAt"] = null;
  if (!open) {
    const later = today
      .map((i) => i.open)
      .filter((o) => toMinutes(o) > now.minutes)
      .sort()[0];
    const tomorrow = ((now.weekday + 1) % 7) as Weekday;
    const first = intervalsFor(hours, nextDate(now.date), tomorrow)
      .map((i) => i.open)
      .sort()[0];
    opensAt = later
      ? { time: later, day: "today" }
      : first
        ? { time: first, day: "tomorrow" }
        : null;
  }
  return { open, minutes: now.minutes, spans, closesAt: open ? closesAt : null, opensAt };
}
