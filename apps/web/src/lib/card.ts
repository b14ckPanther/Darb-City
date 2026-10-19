import {
  emailHref,
  facebookUrl,
  linkedinUrl,
  phoneHref,
  telegramUrl,
  tenbisUrl,
  woltUrl,
  xUrl,
  youtubeUrl,
  googleMapsUrl,
  instagramUrl,
  isByAppointment,
  pickText,
  tiktokUrl,
  websiteUrl,
  type CardIconStyle,
  type Hours,
  type LatLng,
  type Locale,
} from "@darb/core";
import type { BusinessDetailDto } from "@darb/contracts";
import { t } from "@darb/i18n";
import type { IconName } from "@/components/icons/Icon";
import type { CardCopy } from "@/content/card";
import { contrastRatio, readableOn } from "./contrast";
import { MEDIA_ORIGIN } from "./csp";
import {
  addressHidden,
  businessWaze,
  directionsHref,
  primaryAction,
  safeHttpUrl,
  telHref,
  wazeHref,
  whatsappHref,
  type PrimaryAction,
} from "./links";

/** One round button under the main one: an icon, a short word, a place to go. */
export interface CardAction {
  key:
    | "call"
    | "whatsapp"
    | "waze"
    | "maps"
    | "website"
    | "app"
    | "reviews"
    | "booking"
    | "order"
    | "wolt"
    | "tenbis"
    | "email"
    | "phone2";
  icon: IconName;
  label: string;
  href: string;
}

export interface CardSocial {
  key: "instagram" | "facebook" | "tiktok" | "linkedin" | "youtube" | "x" | "telegram";
  label: string;
  href: string;
}

/**
 * Everything a business card shows, already localized and safe to link. The public sheet builds
 * it from the API's business, the /join preview from the form, so both draw the same card.
 */
export interface CardModel {
  name: string;
  /** "Barbershops · Sakhnin". */
  meta: string;
  accent: string;
  /** Black or white, whichever reads on the accent (at least 4.5:1). */
  ink: string;
  icons: CardIconStyle;
  logoUrl: string | null;
  example: boolean;
  glutenFree: boolean;
  /** Visits by arrangement only: "By appointment" instead of open or closed. */
  appointment: boolean;
  /** As the page rendered; the browser recomputes it from `hours`. */
  openNow: boolean | null;
  hours: Hours;
  primary: PrimaryAction;
  primaryIcon: IconName;
  ctaLabel: string;
  actions: CardAction[];
  share: { url: string; title: string } | null;
  /** Null for a home business, whose street stays private. */
  address: string | null;
  photos: { src: string; alt: string }[];
  social: CardSocial[];
}

const SOCIAL = [
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["tiktok", "TikTok"],
  ["youtube", "YouTube"],
  ["linkedin", "LinkedIn"],
  ["x", "X"],
  ["telegram", "Telegram"],
] as const;

export const mediaUrl = (key: string) => `${MEDIA_ORIGIN}/${key}`;

/** The owner's accent, else the sector's, with the ink that reads on it. */
export function cardColors(accent: string | undefined, fallback: string) {
  const color = accent && /^#[0-9a-f]{6}$/i.test(accent) ? accent : fallback;
  const ink = readableOn(color);
  return { accent: color, ink, contrast: contrastRatio(color, ink) };
}

const PRIMARY_ICON: Record<PrimaryAction["kind"], IconName> = {
  app: "app",
  directions: "maps",
  whatsapp: "whatsapp",
  call: "phone",
  example: "phone",
  none: "phone",
};

const primaryWord = (locale: Locale, primary: PrimaryAction) =>
  primary.kind === "app"
    ? t(locale, "openTheApp")
    : primary.kind === "directions"
      ? t(locale, "directions")
      : primary.kind === "whatsapp"
        ? t(locale, "whatsapp")
        : t(locale, "call");

/**
 * The round buttons, in the order people reach for them. Each link once: whatever the main
 * button opens is not repeated below it.
 */
export function cardActions(
  locale: Locale,
  copy: CardCopy,
  links: {
    call: string | null;
    whatsapp: string | null;
    waze: string | null;
    maps: string | null;
    website: string | null;
    apps: string[];
    /** The business's Google Maps page: a link out to its reviews, nothing read from it. */
    reviews?: string | null;
    /** The newer links (booking, ordering, delivery, email, a second phone), already safe. */
    more?: Partial<
      Record<"booking" | "order" | "wolt" | "tenbis" | "email" | "phone2", string | null>
    >;
  },
  primary: PrimaryAction,
): CardAction[] {
  const m = links.more ?? {};
  const main = "href" in primary ? primary.href : null;
  const all: (Omit<CardAction, "href"> & { href: string | null })[] = [
    { key: "call", icon: "phone", label: t(locale, "call"), href: links.call },
    { key: "whatsapp", icon: "whatsapp", label: t(locale, "whatsapp"), href: links.whatsapp },
    { key: "waze", icon: "waze", label: copy.waze, href: links.waze },
    { key: "maps", icon: "maps", label: copy.maps, href: links.maps },
    { key: "website", icon: "globe", label: t(locale, "website"), href: links.website },
    ...links.apps.map((href) => ({
      key: "app" as const,
      icon: "app" as const,
      label: copy.app,
      href,
    })),
    { key: "booking", icon: "calendar", label: copy.booking, href: m.booking ?? null },
    { key: "order", icon: "bag", label: copy.order, href: m.order ?? null },
    { key: "wolt", icon: "delivery", label: copy.wolt, href: m.wolt ?? null },
    { key: "tenbis", icon: "delivery", label: copy.tenbis, href: m.tenbis ?? null },
    { key: "phone2", icon: "phone", label: copy.phone2, href: m.phone2 ?? null },
    { key: "email", icon: "mail", label: copy.email, href: m.email ?? null },
    { key: "reviews", icon: "star", label: copy.googleReviews, href: links.reviews ?? null },
  ];
  const seen = new Set(main ? [main] : []);
  return all.flatMap((a) => {
    if (!a.href || seen.has(a.href)) return [];
    seen.add(a.href);
    return [{ ...a, href: a.href }];
  });
}

/** The newer stored links as the card links them: https pages, a mailto: and a tel: only. */
export function moreLinks(links: Partial<Record<string, string>> | null | undefined) {
  const l = links ?? {};
  const mail = l.email && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(l.email) ? l.email : null;
  const tel = l.phone2 && /^tel:\+?[0-9]{6,15}$/.test(l.phone2) ? l.phone2 : null;
  return {
    booking: safeHttpUrl(l.booking),
    order: safeHttpUrl(l.order),
    wolt: safeHttpUrl(l.wolt),
    tenbis: safeHttpUrl(l.tenbis),
    email: mail,
    phone2: tel,
  };
}

/** The newer links as typed in a form, read the way the API will store them. */
export function moreFromDraft(raw: Partial<Record<string, string>>) {
  const read = (fn: (v: string) => string | null, v: string | undefined) => (v ? fn(v) : null);
  return moreLinks({
    booking: read(websiteUrl, raw.booking) ?? undefined,
    order: read(websiteUrl, raw.order) ?? undefined,
    wolt: read(woltUrl, raw.wolt) ?? undefined,
    tenbis: read(tenbisUrl, raw.tenbis) ?? undefined,
    email: read(emailHref, raw.email) ?? undefined,
    phone2: read(phoneHref, raw.phone2) ?? undefined,
  });
}

export function cardFromBusiness({
  locale,
  copy,
  business,
  kindName,
  placeName,
  sectorAccent,
  ctaLabel,
  shareUrl,
}: {
  locale: Locale;
  copy: CardCopy;
  business: BusinessDetailDto;
  kindName: string;
  placeName: string;
  sectorAccent: string;
  /** The business's own call to action, from its screen, when it has one. */
  ctaLabel: string | null;
  shareUrl: string;
}): CardModel {
  const name = pickText(business.name, locale);
  const primary = primaryAction(business, locale);
  const hidden = addressHidden(business.attributes);
  const greeting = t(locale, "whatsappGreeting", { name });
  const apps =
    business.tier === "darb"
      ? [business.apps.web, business.apps.ios, business.apps.android].flatMap((url) => {
          const safe = safeHttpUrl(url);
          return safe ? [safe] : [];
        })
      : [];
  const { accent, ink } = cardColors(business.cardStyle?.accent, sectorAccent);
  const address = hidden ? "" : pickText(business.address, locale).trim();
  return {
    name,
    meta: `${kindName} · ${placeName}`,
    accent,
    ink,
    icons: business.cardStyle?.icons ?? "line",
    logoUrl: business.logo ? mediaUrl(business.logo.key) : null,
    example: business.tier === "example",
    glutenFree: business.dietary.includes("gluten_free"),
    appointment: isByAppointment(business.hours),
    openNow: business.openNow,
    hours: business.hours,
    primary,
    primaryIcon: PRIMARY_ICON[primary.kind],
    ctaLabel: ctaLabel ?? primaryWord(locale, primary),
    actions: cardActions(
      locale,
      copy,
      {
        call: business.phone ? telHref(business.phone) : null,
        whatsapp: business.whatsapp ? whatsappHref(business.whatsapp, greeting) : null,
        waze: businessWaze(business),
        maps: hidden ? null : directionsHref(business.lat, business.lng),
        // The website is often the client's own app: listed once, as the app.
        website: apps.includes(safeHttpUrl(business.website) ?? "")
          ? null
          : safeHttpUrl(business.website),
        apps,
        // A map page shows the street: a home business keeps it private here too.
        reviews: !hidden && business.links?.google ? googleMapsUrl(business.links.google) : null,
        more: moreLinks(business.links),
      },
      primary,
    ),
    share: { url: shareUrl, title: name },
    address: address || null,
    photos: business.photos.map((p) => ({ src: mediaUrl(p.key), alt: pickText(p.alt, locale) })),
    social: SOCIAL.flatMap(([key, label]) => {
      const href = safeHttpUrl(business.links?.[key] ?? null);
      return href ? [{ key, label, href }] : [];
    }),
  };
}

/**
 * The /join preview's card, from the form as it is typed: the same card the owner's customers
 * will see once it is approved (links read as the API will store them).
 */
export function cardFromDraft(
  locale: Locale,
  copy: CardCopy,
  d: {
    name: string;
    kindName: string | null;
    townName: string | null;
    address: string;
    accent: string;
    icons: CardIconStyle;
    logoUrl: string | null;
    photoUrls: string[];
    phone: string;
    whatsapp: string;
    point: LatLng | null;
    website: string;
    instagram: string;
    facebook: string;
    tiktok: string;
    hours: Hours;
    /** The newer links, as typed (the admin's editor). */
    links?: Partial<Record<string, string>>;
  },
): CardModel {
  const greeting = t(locale, "whatsappGreeting", { name: d.name });
  const call = d.phone.trim() ? telHref(d.phone) : null;
  const whatsapp = d.whatsapp.trim() ? whatsappHref(d.whatsapp, greeting) : null;
  // As a new listing's main button: WhatsApp first, then a call.
  const primary: PrimaryAction = whatsapp
    ? { kind: "whatsapp", href: whatsapp }
    : call
      ? { kind: "call", href: call }
      : { kind: "none" };
  const { accent, ink } = cardColors(d.accent, d.accent);
  const social = (
    [
      ["instagram", "Instagram", instagramUrl(d.instagram)],
      ["facebook", "Facebook", facebookUrl(d.facebook)],
      ["tiktok", "TikTok", tiktokUrl(d.tiktok)],
      ["youtube", "YouTube", d.links?.youtube ? youtubeUrl(d.links.youtube) : null],
      ["linkedin", "LinkedIn", d.links?.linkedin ? linkedinUrl(d.links.linkedin) : null],
      ["x", "X", d.links?.x ? xUrl(d.links.x) : null],
      ["telegram", "Telegram", d.links?.telegram ? telegramUrl(d.links.telegram) : null],
    ] as const
  ).flatMap(([key, label, href]) => (href ? [{ key, label, href }] : []));
  return {
    name: d.name,
    meta: [d.kindName, d.townName].filter(Boolean).join(" · "),
    accent,
    ink,
    icons: d.icons,
    logoUrl: d.logoUrl,
    example: false,
    glutenFree: false,
    appointment: false,
    openNow: null,
    hours: d.hours,
    primary,
    primaryIcon: PRIMARY_ICON[primary.kind],
    ctaLabel: primaryWord(locale, primary),
    actions: cardActions(
      locale,
      copy,
      {
        call,
        whatsapp,
        waze: d.point ? wazeHref(d.point.lat, d.point.lng) : null,
        maps: d.point ? directionsHref(d.point.lat, d.point.lng) : null,
        website: websiteUrl(d.website),
        apps: [],
        more: d.links ? moreFromDraft(d.links) : undefined,
      },
      primary,
    ),
    share: null,
    address: d.address.trim() || null,
    photos: d.photoUrls.map((src) => ({ src, alt: "" })),
    social,
  };
}
