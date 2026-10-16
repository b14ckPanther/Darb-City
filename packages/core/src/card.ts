/**
 * A business card's own look and links (the /join form, the admin and the card). Plain data and
 * small functions with no dependencies, so the browser can use them without zod.
 */

/** The accents an owner may pick: brand-safe on Darb's night background, lower-case hex. */
export const CARD_ACCENTS = [
  "#d9a54c",
  "#e08a6d",
  "#d9aaa2",
  "#a99bd6",
  "#6fa8dc",
  "#5fb3a8",
  "#9fb86a",
  "#d6a473",
] as const;
export type CardAccent = (typeof CARD_ACCENTS)[number];

export const CARD_ICON_STYLES = ["line", "solid"] as const;
export type CardIconStyle = (typeof CARD_ICON_STYLES)[number];

export interface CardStyle {
  accent?: CardAccent;
  icons?: CardIconStyle;
}

/** A business's social links, always full https URLs. The website keeps its own column. */
export interface BusinessLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  /** Only when the owner's Waze link differs from the pin; normally derived from the point. */
  waze?: string;
}
export const LINK_KEYS = ["instagram", "facebook", "tiktok", "waze"] as const;

/** The WHATWG URL every runtime Darb runs on has (Node 22, browsers); core's lib is ES only. */
interface WebUrl {
  protocol: string;
  hostname: string;
  pathname: string;
  searchParams: { get(name: string): string | null };
  toString(): string;
}
declare const URL: new (input: string) => WebUrl;

const url = (raw: string): WebUrl | null => {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
};

/** "example.com/x" or "http://…" to an https URL; null when it is not a web address. */
export function websiteUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return null;
  const u = url(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  if (!u || !u.hostname.includes(".") || u.hostname.endsWith(".")) return null;
  u.protocol = "https:";
  return u.toString();
}

const onHost = (u: WebUrl, hosts: readonly string[]) =>
  hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));

/** "@name", "name" or an instagram.com link to https://www.instagram.com/name/. */
export function instagramUrl(raw: string): string | null {
  const v = raw.trim();
  const handle = /^@?([A-Za-z0-9._]{1,30})$/.exec(v)?.[1];
  if (handle && !handle.includes("..")) return `https://www.instagram.com/${handle.toLowerCase()}/`;
  const u = websiteUrl(v);
  const parsed: WebUrl | null = u ? new URL(u) : null;
  if (!parsed || !onHost(parsed, ["instagram.com"])) return null;
  const name = /^\/([A-Za-z0-9._]{1,30})\/?$/.exec(parsed.pathname)?.[1];
  return name ? `https://www.instagram.com/${name.toLowerCase()}/` : null;
}

/** "@name", "name" or a facebook.com / fb.com link to an https facebook.com URL. */
export function facebookUrl(raw: string): string | null {
  const v = raw.trim();
  const handle = /^@?([A-Za-z0-9.-]{3,50})$/.exec(v)?.[1];
  if (handle && !handle.includes(".com")) return `https://www.facebook.com/${handle}`;
  const u = websiteUrl(v);
  const parsed: WebUrl | null = u ? new URL(u) : null;
  if (!parsed || !onHost(parsed, ["facebook.com", "fb.com"])) return null;
  if (parsed.pathname === "/" || parsed.pathname === "") return null;
  // profile.php?id= is the only query worth keeping; tracking parameters go.
  const id = parsed.pathname === "/profile.php" ? parsed.searchParams.get("id") : null;
  const path = parsed.pathname.replace(/\/+$/, "");
  return `https://www.facebook.com${path}${id && /^\d+$/.test(id) ? `?id=${id}` : ""}`;
}

/** "@name", "name" or a tiktok.com link to https://www.tiktok.com/@name. */
export function tiktokUrl(raw: string): string | null {
  const v = raw.trim();
  const handle = /^@?([A-Za-z0-9._]{2,24})$/.exec(v)?.[1];
  if (handle) return `https://www.tiktok.com/@${handle.toLowerCase()}`;
  const u = websiteUrl(v);
  const parsed: WebUrl | null = u ? new URL(u) : null;
  if (!parsed || !onHost(parsed, ["tiktok.com"])) return null;
  const name = /^\/@([A-Za-z0-9._]{2,24})\/?/.exec(parsed.pathname)?.[1];
  return name ? `https://www.tiktok.com/@${name.toLowerCase()}` : null;
}

/** A waze.com link as an https URL; anything else is null. */
export function wazeUrl(raw: string): string | null {
  const u = websiteUrl(raw);
  const parsed: WebUrl | null = u ? new URL(u) : null;
  return parsed && onHost(parsed, ["waze.com"]) ? parsed.toString() : null;
}

/** Driving directions to a point in Waze. */
export const wazeDirections = (lat: number, lng: number): string =>
  `https://waze.com/ul?ll=${lat.toFixed(6)},${lng.toFixed(6)}&navigate=yes`;

/** Each link through its own normaliser; what does not read as that link is dropped. */
export function normalizeLinks(raw: Partial<Record<keyof BusinessLinks, string | null>>) {
  const out: BusinessLinks = {};
  const fns = { instagram: instagramUrl, facebook: facebookUrl, tiktok: tiktokUrl, waze: wazeUrl };
  for (const key of LINK_KEYS) {
    const v = raw[key];
    const n = v ? fns[key](v) : null;
    if (n) out[key] = n;
  }
  return out;
}

const HEBREW: Record<string, string> = {
  א: "a",
  ב: "b",
  ג: "g",
  ד: "d",
  ה: "h",
  ו: "v",
  ז: "z",
  ח: "ch",
  ט: "t",
  י: "y",
  כ: "k",
  ך: "k",
  ל: "l",
  מ: "m",
  ם: "m",
  נ: "n",
  ן: "n",
  ס: "s",
  ע: "a",
  פ: "p",
  ף: "f",
  צ: "ts",
  ץ: "ts",
  ק: "k",
  ר: "r",
  ש: "sh",
  ת: "t",
};
const ARABIC: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  ة: "a",
  و: "w",
  ي: "y",
  ى: "a",
  ئ: "e",
  ؤ: "o",
  ء: "",
};

/**
 * Hebrew and Arabic letters to rough Latin, letter by letter (no vowels are written, so "סלון"
 * is "slvn"): only for URL slugs, never shown as a name.
 */
export function latinize(text: string): string {
  return [...text].map((c) => HEBREW[c] ?? ARABIC[c] ?? c).join("");
}
