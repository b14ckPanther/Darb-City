import { LOCALES, type Locale } from "@darb/core";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Intl tags. Arabic in Israel writes Latin digits, so Arabic asks for them explicitly. */
export const INTL_TAG: Record<Locale, string> = {
  he: "he-IL",
  ar: "ar-IL-u-nu-latn",
  en: "en-IL",
};

export const OG_LOCALE: Record<Locale, string> = { he: "he_IL", ar: "ar_IL", en: "en_IL" };
