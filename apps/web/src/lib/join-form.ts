import type { JoinCreateInput, JoinSuggestionDto } from "@darb/contracts";
import {
  CARD_ACCENTS,
  facebookUrl,
  inIsrael,
  instagramUrl,
  tiktokUrl,
  websiteUrl,
  type CardAccent,
  type CardIconStyle,
  type LatLng,
  type Locale,
} from "@darb/core";
import { badDays, emptyWeek, weekFromHours, weekToHours, type Week } from "./week-hours";

/**
 * The /join form's state and its own checks: the same rules as JoinCreateSchema (join-form.test.ts
 * holds them together), kept apart from @darb/contracts so the browser never loads zod.
 */
export interface Uploaded {
  key: string;
  url: string;
}
type Texts = Record<Locale, string>;

export interface JoinFields {
  name: Texts;
  kindSlug: string;
  placeSlug: string;
  point: LatLng | null;
  /** In the owner's language. */
  address: string;
  phone: string;
  whatsapp: string;
  whatsappSame: boolean;
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  week: Week;
  description: Texts;
  logo: Uploaded | null;
  photos: Uploaded[];
  accent: CardAccent;
  icons: CardIconStyle;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  note: string;
}

export const MAX_PHOTOS = 6;
const blank = (): Texts => ({ he: "", ar: "", en: "" });

export const emptyFields = (): JoinFields => ({
  name: blank(),
  kindSlug: "",
  placeSlug: "",
  point: null,
  address: "",
  phone: "",
  whatsapp: "",
  whatsappSame: true,
  website: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  week: emptyWeek(),
  description: blank(),
  logo: null,
  photos: [],
  accent: CARD_ACCENTS[0],
  icons: "line",
  ownerName: "",
  ownerPhone: "",
  ownerEmail: "",
  note: "",
});

/** What the lookup found, laid over an empty form; the owner edits everything after. */
export function fromSuggestion(s: JoinSuggestionDto): JoinFields {
  const f = emptyFields();
  const texts = (t: Partial<Texts> | undefined): Texts => ({ ...blank(), ...stripNull(t) });
  return {
    ...f,
    name: texts(s.name),
    kindSlug: s.kindSlug ?? "",
    placeSlug: s.placeSlug ?? "",
    point: s.point ?? null,
    address: s.address ?? "",
    phone: s.phone ?? "",
    whatsapp: s.whatsapp ?? "",
    whatsappSame: !s.whatsapp || s.whatsapp === s.phone,
    website: s.website ?? "",
    instagram: s.links?.instagram ?? "",
    facebook: s.links?.facebook ?? "",
    tiktok: s.links?.tiktok ?? "",
    week: s.hours ? weekFromHours(s.hours) : f.week,
    description: texts(s.description),
  };
}

const stripNull = (t: Partial<Record<string, string | undefined | null>> | undefined) =>
  Object.fromEntries(Object.entries(t ?? {}).filter((e): e is [string, string] => !!e[1]));

const PHONE = /^\+?[0-9][0-9 ()-]{5,19}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isPhone = (v: string) => PHONE.test(v.trim());

export type JoinError =
  | "name"
  | "kind"
  | "place"
  | "point"
  | "phone"
  | "whatsapp"
  | "website"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "hours"
  | "ownerName"
  | "ownerPhone"
  | "ownerEmail";

/** In the order the form shows them, so the first one gets the focus. */
export const ERROR_ORDER: readonly JoinError[] = [
  "name",
  "kind",
  "place",
  "point",
  "phone",
  "whatsapp",
  "website",
  "instagram",
  "facebook",
  "tiktok",
  "hours",
  "ownerName",
  "ownerPhone",
  "ownerEmail",
];

/** Each field that cannot be sent. Optional fields are only checked when filled. */
export function fieldErrors(f: JoinFields): Partial<Record<JoinError, true>> {
  const e: Partial<Record<JoinError, true>> = {};
  if (!Object.values(f.name).some((v) => v.trim())) e.name = true;
  if (!f.kindSlug) e.kind = true;
  if (!f.placeSlug) e.place = true;
  if (!f.point || !inIsrael(f.point)) e.point = true;
  if (f.phone.trim() && !isPhone(f.phone)) e.phone = true;
  if (!f.whatsappSame && f.whatsapp.trim() && !isPhone(f.whatsapp)) e.whatsapp = true;
  if (f.website.trim() && !websiteUrl(f.website)) e.website = true;
  if (f.instagram.trim() && !instagramUrl(f.instagram)) e.instagram = true;
  if (f.facebook.trim() && !facebookUrl(f.facebook)) e.facebook = true;
  if (f.tiktok.trim() && !tiktokUrl(f.tiktok)) e.tiktok = true;
  if (badDays(f.week).length) e.hours = true;
  const owner = f.ownerName.trim().length;
  if (owner < 2 || owner > 80) e.ownerName = true;
  if (!isPhone(f.ownerPhone)) e.ownerPhone = true;
  if (f.ownerEmail.trim() && !EMAIL.test(f.ownerEmail.trim())) e.ownerEmail = true;
  return e;
}

const someTexts = (t: Texts) =>
  Object.fromEntries(
    Object.entries(t)
      .map(([k, v]) => [k, v.trim()] as const)
      .filter(([, v]) => v),
  );

/** The body /api/join takes: blanks dropped, WhatsApp from the phone when the box says so. */
export function joinBody(
  f: JoinFields,
  options: {
    locale: Locale;
    source: "lookup" | "manual";
    lookup: JoinSuggestionDto | null;
    website2: string;
  },
): JoinCreateInput {
  const phone = f.phone.trim() || null;
  const whatsapp = f.whatsappSame ? phone : f.whatsapp.trim() || null;
  const links = Object.fromEntries(
    (["instagram", "facebook", "tiktok"] as const)
      .map((k) => [k, f[k].trim()] as const)
      .filter(([, v]) => v),
  );
  const address = f.address.trim();
  return {
    name: someTexts(f.name),
    kindSlug: f.kindSlug,
    placeSlug: f.placeSlug,
    lat: f.point!.lat,
    lng: f.point!.lng,
    address: address ? { [options.locale]: address.slice(0, 200) } : {},
    phone,
    whatsapp,
    website: f.website.trim() || null,
    links,
    hours: weekToHours(f.week),
    description: someTexts(f.description),
    logo: f.logo?.key ?? null,
    photos: f.photos.map((p) => p.key).slice(0, MAX_PHOTOS),
    cardStyle: { accent: f.accent, icons: f.icons },
    owner: {
      name: f.ownerName.trim(),
      phone: f.ownerPhone.trim(),
      ...(f.ownerEmail.trim() ? { email: f.ownerEmail.trim() } : {}),
    },
    ...(f.note.trim() ? { note: f.note.trim().slice(0, 1000) } : {}),
    source: options.source,
    ...(options.lookup ? { lookup: options.lookup } : {}),
    locale: options.locale,
    ...(options.website2 ? { website2: options.website2 } : {}),
  };
}

/** "Find my business": a link when it looks like one, otherwise a name and town. */
export function lookupBody(text: string, locale: Locale) {
  const v = text.trim();
  const isLink = /^(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+\/\S*$|^https?:\/\//i.test(v);
  return isLink ? { url: v, locale } : { query: v.slice(0, 200), locale };
}
