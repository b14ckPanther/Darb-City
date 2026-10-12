import type { Locale } from "@darb/core";
import { ar } from "./messages/ar.js";
import { en, type Messages } from "./messages/en.js";
import { he } from "./messages/he.js";

export type { Messages };

export const messages: Record<Locale, Messages> = { he, ar, en };

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "en" ? "ltr" : "rtl";
}

/** A message for the locale, with each `{name}` filled from `vars`. Unknown names stay as written. */
export function t(
  locale: Locale,
  key: keyof Messages,
  vars: Record<string, string | number> = {},
): string {
  return messages[locale][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}
