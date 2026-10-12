import { notFound } from "next/navigation";
import type { Locale } from "@darb/core";
import { isLocale } from "./locale";

/** The root of the place tree. `/israel` redirects to `/`. */
export const COUNTRY_SLUG = "israel";

export function localeOrNotFound(value: string): Locale {
  if (!isLocale(value)) notFound();
  return value;
}
