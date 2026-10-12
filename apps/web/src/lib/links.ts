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

export type PrimaryAction =
  | { kind: "whatsapp"; href: string }
  | { kind: "call"; href: string }
  | { kind: "example" }
  | { kind: "none" };

export function primaryAction(
  business: { whatsapp: string | null; phone: string | null; tier: Tier; name: Localized },
  locale: Locale,
): PrimaryAction {
  const greeting = t(locale, "whatsappGreeting", { name: pickText(business.name, locale) });
  const whatsapp = business.whatsapp ? whatsappHref(business.whatsapp, greeting) : null;
  if (whatsapp) return { kind: "whatsapp", href: whatsapp };
  const call = business.phone ? telHref(business.phone) : null;
  if (call) return { kind: "call", href: call };
  return business.tier === "example" ? { kind: "example" } : { kind: "none" };
}
