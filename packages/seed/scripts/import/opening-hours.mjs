// OpenStreetMap opening_hours into Darb's Hours ({ weekly: { 0..6: [{ open, close }] } }, Sunday
// is 0). Reads the forms the north's food places use: "24/7", "Mo-Fr 09:00-18:00; Sa off",
// "Su-Th 08:00-22:00, Fr 08:00-14:00", day lists, ranges across the week ("Sa-Th"), several
// ranges a day, a times-only rule for every day, "PH off" and other holiday rules ignored.
// Anything Darb cannot say for sure (sunset, open ends, "unknown", months, comments, several
// rules without days) gives null, and the card shows no hours rather than wrong ones.

const DAYS = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const ALL = [0, 1, 2, 3, 4, 5, 6];

/** "9:30" → "09:30", "00:00" as a close → "24:00", "26:00" → "02:00"; null when not a time. */
function time(raw, { close = false } = {}) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 48) return null;
  if (h === 24 && min > 0) h -= 24;
  if (h > 24) h -= 24;
  if (close && h === 0 && min === 0) h = 24;
  if (!close && h === 24) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "Mo-Fr" → [1..5], "Sa-Th" wraps → [6, 0, 1, 2, 3, 4]; null when not a weekday selector. */
function dayRange(token) {
  const m = /^([A-Za-z]{2})(?:-([A-Za-z]{2}))?$/.exec(token);
  if (!m) return null;
  const a = DAYS[m[1].toLowerCase()];
  const b = m[2] === undefined ? a : DAYS[m[2].toLowerCase()];
  if (a === undefined || b === undefined) return null;
  const out = [];
  for (let d = a; ; d = (d + 1) % 7) {
    out.push(d);
    if (d === b) break;
  }
  return out;
}

/** One rule ("Su-Th, Sa 08:00-12:00,16:00-20:00") → { days, intervals | "off" }, or null. */
function rule(text) {
  const s = text.trim();
  const m =
    /^((?:[A-Za-z]{2}(?:-[A-Za-z]{2})?)(?:\s*,\s*[A-Za-z]{2}(?:-[A-Za-z]{2})?)*)?\s*(.*)$/.exec(s);
  if (!m) return null;
  let days = ALL;
  if (m[1]) {
    const set = new Set();
    for (const part of m[1].split(/\s*,\s*/)) {
      const r = dayRange(part);
      if (!r) return null;
      for (const d of r) set.add(d);
    }
    days = [...set];
  }
  const rest = m[2].trim();
  if (/^(off|closed)$/i.test(rest)) return { days, intervals: "off", hasDays: Boolean(m[1]) };
  if (!rest) return null;
  const intervals = [];
  for (const piece of rest.split(/\s*,\s*/)) {
    const r = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(piece);
    if (!r) return null;
    const open = time(r[1]);
    const close = time(r[2], { close: true });
    if (!open || !close || open === close) return null;
    intervals.push({ open, close });
  }
  return { days, intervals, hasDays: Boolean(m[1]) };
}

const DAY_LIST = /^[A-Za-z]{2}(?:-[A-Za-z]{2})?(?=\s|,|$)/;
const HAS_TIMES = /\d|\b(off|closed)\b/i;

/**
 * Rules a field holds: ";" always separates; "," separates too when a weekday starts the next
 * rule, but "Mo-Th, Su 11:00-22:30" is one rule (its days were not done) and
 * "08:00-12:00, 16:00-20:00" one rule's two ranges.
 */
function splitRules(field) {
  const out = [];
  for (const part of field.split(/\s*;\s*/)) {
    let current = "";
    for (const piece of part.split(/\s*,\s*/)) {
      if (!current) current = piece;
      else if (!HAS_TIMES.test(current) || !DAY_LIST.test(piece)) current += `,${piece}`;
      else {
        out.push(current);
        current = piece;
      }
    }
    if (current.trim()) out.push(current.trim());
  }
  return out;
}

/** Holiday rules ("PH off", "SH 10:00-12:00", "PH"): they say nothing about a normal week. */
const HOLIDAY = /^(PH|SH)\b/;

/** Darb Hours from an OSM opening_hours value, or null when it cannot be read for sure. */
export function parseOpeningHours(raw) {
  if (typeof raw !== "string") return null;
  // Spaces around a range's dash go, and a "+" after a full range ("10:00-22:00+": maybe later).
  const field = raw
    .trim()
    .replace(/\s*-\s*/g, "-")
    .replace(/(\d{1,2}:\d{2}-\d{1,2}:\d{2})\+/g, "$1")
    // A missing separator between rules ("Su-Th 11:00-00:00 Fr 11:00-14:30").
    .replace(/(\d{2}) +(?=[A-Z][a-z](?:-[A-Z][a-z])?(?:,[A-Z][a-z])* +\d)/g, "$1; ")
    // A holiday inside a day list ("PH,Mo-Su 09:00-22:50") is a holiday rule's business.
    .replace(/(^|;\s*)(?:PH|SH)\s*,\s*/g, "$1");
  if (!field) return null;
  if (/^24\/7$/.test(field) || /^(Mo-Su|Su-Sa)?\s*00:00-(24|00):00$/.test(field)) return always();
  // Sunrise and sunset, open ends, months, weeks, comments and "unknown" are not said for sure.
  if (
    /sunset|sunrise|dawn|dusk|unknown|"|\?|\+|\|\||week|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(
      field,
    )
  )
    return null;
  const weekly = {};
  let dayless = 0;
  let any = false;
  for (const text of splitRules(field)) {
    if (HOLIDAY.test(text)) continue;
    const r = rule(text);
    if (!r) return null;
    if (!r.hasDays) dayless++;
    // Several rules without days ("12:00-22:00; 12:00-22:30") were meant per day: unknown which.
    if (dayless > 1) return null;
    any = true;
    for (const d of r.days) weekly[d] = r.intervals === "off" ? [] : r.intervals;
  }
  if (!any) return null;
  // A day a rule closed is simply not open: Darb writes only open days.
  const out = {};
  for (const d of ALL) if (weekly[d]?.length) out[String(d)] = weekly[d];
  if (!Object.keys(out).length) return null;
  return { weekly: out, exceptions: [] };
}

function always() {
  return {
    weekly: Object.fromEntries(ALL.map((d) => [String(d), [{ open: "00:00", close: "24:00" }]])),
    exceptions: [],
  };
}
