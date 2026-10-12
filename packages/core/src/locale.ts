export type Locale = "he" | "ar" | "en";

export const LOCALES: readonly Locale[] = ["he", "ar", "en"];
export const DEFAULT_LOCALE: Locale = "he";

/** Text a person reads, in any of Darb's languages. At least one value must be non-blank. */
export type Localized = Partial<Record<Locale, string>>;

const FALLBACK: Record<Locale, readonly Locale[]> = {
  he: ["he", "ar", "en"],
  ar: ["ar", "he", "en"],
  en: ["en", "he", "ar"],
};

export function pickText(value: Localized, locale: Locale): string {
  for (const candidate of FALLBACK[locale]) {
    const text = value[candidate];
    if (text !== undefined && text.trim() !== "") return text;
  }
  return "";
}

export function hasText(value: Localized): boolean {
  return LOCALES.some((locale) => (value[locale] ?? "").trim() !== "");
}
