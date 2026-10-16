import { pickText, type Locale, type Localized, type Tier } from "@darb/core";
import { t } from "@darb/i18n";

/** Only http(s) URLs are ever rendered as links (closes the Plan 1 `apps.*` scheme finding). */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** 972XXXXXXXXX, or null when the number is too short to dial. */
function internationalDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (digits.startsWith("972")) return digits;
  return digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
}

export function telHref(phone: string): string | null {
  const digits = internationalDigits(phone);
  return digits ? `tel:+${digits}` : null;
}

export function whatsappHref(phone: string, text: string): string | null {
  const digits = internationalDigits(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

export function directionsHref(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Driving there in Waze, the app most drivers here use; Google Maps stays the second way. */
export function wazeHref(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

/**
 * Waze for a business: the owner's own Waze link when they gave one, else the pin. Null for a home
 * business, whose street stays private (its pin is only the town).
 */
export function businessWaze(business: {
  lat: number;
  lng: number;
  links?: { waze?: string };
  attributes?: Record<string, unknown>;
}): string | null {
  if (addressHidden(business.attributes)) return null;
  const own = safeHttpUrl(business.links?.waze);
  return own && /^https:\/\/(?:[\w-]+\.)*waze\.com\//.test(own)
    ? own
    : wazeHref(business.lat, business.lng);
}

export type PrimaryAction =
  | { kind: "app"; href: string }
  | { kind: "directions"; href: string }
  | { kind: "whatsapp"; href: string }
  | { kind: "call"; href: string }
  | { kind: "example" }
  | { kind: "none" };

/** A home business keeps its street private: nothing navigates to its town-level pin. */
export const addressHidden = (attributes: Record<string, unknown> | undefined) =>
  attributes?.["addressHidden"] === true;

/**
 * The main button: a Darb client's own app first (darb tier only), then directions when the
 * business asks for them (attributes.primaryAction, e.g. a fuel station), then WhatsApp or a call.
 */
export function primaryAction(
  business: {
    whatsapp: string | null;
    phone: string | null;
    tier: Tier;
    name: Localized;
    apps?: { web?: string };
    attributes?: Record<string, unknown>;
    lat?: number;
    lng?: number;
  },
  locale: Locale,
): PrimaryAction {
  const app = business.tier === "darb" ? safeHttpUrl(business.apps?.web) : null;
  if (app) return { kind: "app", href: app };
  if (
    business.attributes?.["primaryAction"] === "directions" &&
    !addressHidden(business.attributes) &&
    business.lat !== undefined &&
    business.lng !== undefined
  )
    return { kind: "directions", href: directionsHref(business.lat, business.lng) };
  const greeting = t(locale, "whatsappGreeting", { name: pickText(business.name, locale) });
  const whatsapp = business.whatsapp ? whatsappHref(business.whatsapp, greeting) : null;
  if (whatsapp) return { kind: "whatsapp", href: whatsapp };
  const call = business.phone ? telHref(business.phone) : null;
  if (call) return { kind: "call", href: call };
  return business.tier === "example" ? { kind: "example" } : { kind: "none" };
}
