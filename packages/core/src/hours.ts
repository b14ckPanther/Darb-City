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
