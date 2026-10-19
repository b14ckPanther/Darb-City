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
  /** The business's own Google Maps page: only a link out to its reviews, nothing is read from it. */
  google?: string;
  linkedin?: string;
  youtube?: string;
  /** X (formerly Twitter). */
  x?: string;
  telegram?: string;
  /** A mailto: link. */
  email?: string;
  /** Booking an appointment or a table: any https page. */
  booking?: string;
  /** Ordering online (its own shop or menu): any https page. */
  order?: string;
  /** Delivery apps: the business's page there. */
  wolt?: string;
  tenbis?: string;
  /** A second phone line, as a tel: link. */
  phone2?: string;
}
export const LINK_KEYS = [
  "instagram",
  "facebook",
  "tiktok",
  "waze",
  "google",
  "linkedin",
  "youtube",
  "x",
  "telegram",
  "email",
  "booking",
  "order",
  "wolt",
  "tenbis",
  "phone2",
] as const;

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

const GOOGLE_TLD = /^(?:www\.)?google\.(?:com|co\.il|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/;

/**
 * A Google Maps link as an https URL: google.com/maps…, maps.google.…, maps.app.goo.gl/… or
 * goo.gl/maps/…. Anything else is null. The link is kept as given (no fetching here).
 */
export function googleMapsUrl(raw: string): string | null {
  const u = websiteUrl(raw);
  const parsed: WebUrl | null = u ? new URL(u) : null;
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;
  const ok =
    (GOOGLE_TLD.test(host) && (path === "/maps" || path.startsWith("/maps/"))) ||
    /^maps\.google\.(?:com|co\.il|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(host) ||
    (host === "maps.app.goo.gl" && path.length > 1) ||
    (host === "goo.gl" && path.startsWith("/maps/"));
  return ok ? parsed.toString() : null;
}

/** A linkedin.com profile or company page (a bare name is ambiguous between the two). */
export function linkedinUrl(raw: string): string | null {
  const u = websiteUrl(raw);
  const parsed: WebUrl | null = u ? new URL(u) : null;
  if (!parsed || !onHost(parsed, ["linkedin.com"])) return null;
  const m = /^\/(in|company|school)\/([A-Za-z0-9_%.-]{2,100})\/?/.exec(parsed.pathname);
  return m ? `https://www.linkedin.com/${m[1]}/${m[2]}/` : null;
}

/** "@name" or a youtube.com / youtu.be link to an https YouTube URL. */
export function youtubeUrl(raw: string): string | null {
  const v = raw.trim();
  const handle = /^@([A-Za-z0-9._-]{3,30})$/.exec(v)?.[1];
  if (handle) return `https://www.youtube.com/@${handle}`;
  const u = websiteUrl(v);
  const parsed: WebUrl | null = u ? new URL(u) : null;
  if (!parsed || !onHost(parsed, ["youtube.com", "youtu.be"])) return null;
  if (parsed.pathname === "/" || parsed.pathname === "") return null;
  return parsed.toString();
}

/** "@name", "name" or an x.com / twitter.com link to https://x.com/name. */
export function xUrl(raw: string): string | null {
  const v = raw.trim();
  const handle = /^@?([A-Za-z0-9_]{1,15})$/.exec(v)?.[1];
  if (handle) return `https://x.com/${handle}`;
  const u = websiteUrl(v);
  const parsed: WebUrl | null = u ? new URL(u) : null;
  if (!parsed || !onHost(parsed, ["x.com", "twitter.com"])) return null;
  const name = /^\/([A-Za-z0-9_]{1,15})\/?$/.exec(parsed.pathname)?.[1];
  return name ? `https://x.com/${name}` : null;
}

/** "@name", "name" or a t.me / telegram.me link to https://t.me/name. */
export function telegramUrl(raw: string): string | null {
  const v = raw.trim();
  const handle = /^@?([A-Za-z0-9_]{5,32})$/.exec(v)?.[1];
  if (handle) return `https://t.me/${handle}`;
  const u = websiteUrl(v);
  const parsed: WebUrl | null = u ? new URL(u) : null;
  if (!parsed || !onHost(parsed, ["t.me", "telegram.me"])) return null;
  const name = /^\/([A-Za-z0-9_+]{5,64})\/?$/.exec(parsed.pathname)?.[1];
  return name ? `https://t.me/${name}` : null;
}

/** An email address (or a mailto: link) to a mailto: link, lower-cased; anything else is null. */
export function emailHref(raw: string): string | null {
  const v = raw
    .trim()
    .replace(/^mailto:/i, "")
    .toLowerCase();
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(v) && v.length <= 200
    ? `mailto:${v}`
    : null;
}

/** A Wolt link (any wolt.com page) as an https URL. */
export function woltUrl(raw: string): string | null {
  const u = websiteUrl(raw);
  const parsed: WebUrl | null = u ? new URL(u) : null;
  return parsed && onHost(parsed, ["wolt.com"]) && parsed.pathname.length > 1
    ? parsed.toString()
    : null;
}

/** A 10bis link (10bis.co.il) as an https URL. */
export function tenbisUrl(raw: string): string | null {
  const u = websiteUrl(raw);
  const parsed: WebUrl | null = u ? new URL(u) : null;
  return parsed && onHost(parsed, ["10bis.co.il"]) && parsed.pathname.length > 1
    ? parsed.toString()
    : null;
}

/**
 * A phone number as people write it ("04-674 0000", "+972 50 123 4567") to a tel: link; Israeli
 * local numbers become +972. Null when it is not a phone number.
 */
export function phoneHref(raw: string): string | null {
  const v = raw.trim().replace(/^tel:/i, "");
  if (!/^\+?[0-9][0-9 ()-]{5,19}$/.test(v)) return null;
  const digits = v.replace(/[^0-9]/g, "");
  if (v.startsWith("+")) return `tel:+${digits}`;
  if (digits.startsWith("0")) return `tel:+972${digits.slice(1)}`;
  return `tel:${digits}`;
}

/** Driving directions to a point in Waze. */
export const wazeDirections = (lat: number, lng: number): string =>
  `https://waze.com/ul?ll=${lat.toFixed(6)},${lng.toFixed(6)}&navigate=yes`;

/** Each link through its own normaliser; what does not read as that link is dropped. */
export function normalizeLinks(raw: Partial<Record<keyof BusinessLinks, string | null>>) {
  const out: BusinessLinks = {};
  const fns = {
    instagram: instagramUrl,
    facebook: facebookUrl,
    tiktok: tiktokUrl,
    waze: wazeUrl,
    google: googleMapsUrl,
    linkedin: linkedinUrl,
    youtube: youtubeUrl,
    x: xUrl,
    telegram: telegramUrl,
    email: emailHref,
    booking: websiteUrl,
    order: websiteUrl,
    wolt: woltUrl,
    tenbis: tenbisUrl,
    phone2: phoneHref,
  };
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
