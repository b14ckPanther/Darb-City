import {
  facebookUrl,
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
  key: "call" | "whatsapp" | "waze" | "maps" | "website" | "app" | "reviews";
  icon: IconName;
  label: string;
  href: string;
}

export interface CardSocial {
  key: "instagram" | "facebook" | "tiktok";
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
  },
  primary: PrimaryAction,
): CardAction[] {
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
    { key: "reviews", icon: "star", label: copy.googleReviews, href: links.reviews ?? null },
  ];
  const seen = new Set(main ? [main] : []);
  return all.flatMap((a) => {
    if (!a.href || seen.has(a.href)) return [];
    seen.add(a.href);
    return [{ ...a, href: a.href }];
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
      },
      primary,
    ),
    share: null,
    address: d.address.trim() || null,
    photos: d.photoUrls.map((src) => ({ src, alt: "" })),
    social,
  };
}
