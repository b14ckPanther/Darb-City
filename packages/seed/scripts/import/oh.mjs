// OpenStreetMap opening_hours into Darb Hours ({ weekly: { "0": [{ open, close }] }, exceptions }).
// Self-contained. Reads the common forms ("Su-Th 08:00-19:00; Fr 08:00-14:00; Sa off", "24/7",
// "Mo-Fr 09:00-13:00,16:00-19:00", "08:00-20:00"); anything it cannot read for certain (months,
// dates, sunrise, open ends, comments, week numbers) gives null, never a guess.

/** OSM day codes to Darb weekday numbers (Sunday 0). */
export const DAYS = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
const DAY = "(?:Su|Mo|Tu|We|Th|Fr|Sa)";
const DAY_SPEC = new RegExp(`^${DAY}(?:-${DAY})?(?:,${DAY}(?:-${DAY})?)*$`);
const TIME = /^(\d{1,2}):(\d{2})$/;

function time(raw) {
  const m = TIME.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min !== 0)) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/** "Mo-Fr,Su" → [1, 2, 3, 4, 5, 0]; wraps ("Fr-Mo" → Fr Sa Su Mo). */
export function parseDays(spec) {
  if (!DAY_SPEC.test(spec)) return null;
  const out = [];
  for (const part of spec.split(",")) {
    const [a, b] = part.split("-");
    const from = DAYS[a];
    const to = b === undefined ? from : DAYS[b];
    for (let d = from; ; d = (d + 1) % 7) {
      if (!out.includes(d)) out.push(d);
      if (d === to) break;
    }
  }
  return out;
}

/** "09:00-13:00,16:00-19:00" → intervals, or null when a part is not a plain time range. */
export function parseTimes(spec) {
  const out = [];
  for (const part of spec.split(",")) {
    const m = /^\s*([\d:]+)\s*-\s*([\d:]+)\s*$/.exec(part);
    if (!m) return null;
    const open = time(m[1]);
    let close = time(m[2]);
    if (!open || !close) return null;
    if (close === "00:00") close = "24:00";
    if (open === "24:00" || open === close) return null;
    out.push({ open, close });
  }
  return out;
}

const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

/**
 * One OSM opening_hours value to Darb Hours, or null when it is empty or not certain.
 * Later rules replace earlier ones for the days they name, as in OSM.
 */
export function parseOpeningHours(raw) {
  if (raw === null || raw === undefined) return null;
  let text = String(raw).trim();
  if (!text) return null;
  if (/^24\/7$/i.test(text) || /^Mo-Su 00:00-24:00$/.test(text))
    return {
      weekly: Object.fromEntries(
        ALL_WEEK.map((d) => [String(d), [{ open: "00:00", close: "24:00" }]]),
      ),
      exceptions: [],
    };
  // Holidays are not dated in Darb's week: "PH off" and its like are dropped, nothing else.
  text = text
    .split(";")
    .map((r) => r.trim())
    .filter((r) => r && !/^(PH|SH)(\s|,|$)/.test(r))
    .join(";");
  if (!text) return null;
  // "Mo-Fr 08:00-12:00, Sa 09:00-11:00": a comma before a day starts another rule.
  const rules = text.split(new RegExp(`;|(?<=\\d)\\s*,\\s*(?=${DAY}[\\s,-])`)).map((r) => r.trim());
  const weekly = {};
  let any = false;
  for (const rule of rules) {
    if (!rule) continue;
    const m = /^(\S+)\s+(.+)$/.exec(rule);
    let days;
    let rest;
    if (m && DAY_SPEC.test(m[1].replace(/,PH|PH,/g, ""))) {
      days = parseDays(m[1].replace(/,PH|PH,/g, ""));
      rest = m[2].trim();
    } else if (/^\d/.test(rule)) {
      days = ALL_WEEK;
      rest = rule;
    } else if (DAY_SPEC.test(rule)) {
      return null; // days with no times say nothing certain
    } else return null;
    if (!days) return null;
    if (/^(off|closed)$/i.test(rest)) {
      for (const d of days) weekly[String(d)] = [];
      continue;
    }
    const times = parseTimes(rest.replace(/\s+open$/i, ""));
    if (!times) return null;
    for (const d of days) weekly[String(d)] = times.map((t) => ({ ...t }));
    any = true;
  }
  if (!any) return null;
  for (const d of Object.keys(weekly)) if (weekly[d].length === 0) delete weekly[d];
  return { weekly, exceptions: [] };
}
