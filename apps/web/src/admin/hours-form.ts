import type { Hours } from "@darb/core";

export type Weekly = Hours["weekly"];
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export function exceptionsToText(ex: Hours["exceptions"]): string {
  return ex
    .map(
      (e) =>
        `${e.date} ${e.intervals.length ? e.intervals.map((i) => `${i.open}-${i.close}`).join(" ") : "closed"}`,
    )
    .join("\n");
}

export function parseExceptions(
  text: string,
): { ok: true; value: Hours["exceptions"] } | { ok: false; line: string } {
  const value: Hours["exceptions"] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [date, ...rest] = line.split(/\s+/);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || rest.length === 0) return { ok: false, line };
    if (rest.length === 1 && rest[0] === "closed") {
      value.push({ date, intervals: [] });
      continue;
    }
    const intervals = rest.map((r) => r.split("-"));
    if (intervals.some(([o, c]) => !o || !c || !TIME.test(o) || !TIME.test(c)))
      return { ok: false, line };
    value.push({
      date,
      intervals: intervals.map(([open, close]) => ({ open: open!, close: close! })),
    });
  }
  return { ok: true, value };
}
