import type { Locale } from "@darb/core";
import { ar } from "./messages/ar.js";
import { en, type Messages } from "./messages/en.js";
import { he } from "./messages/he.js";

export type { Messages };

export const messages: Record<Locale, Messages> = { he, ar, en };

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "en" ? "ltr" : "rtl";
}
