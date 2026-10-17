import { LOCALES, pickText, type Locale, type Localized } from "@darb/core";
import type { ScreenDto } from "@darb/contracts";
import { matchKey, splitList } from "@darb/search-text";
import styles from "./templates.module.css";

export interface TemplateProps {
  screen: ScreenDto;
  locale: Locale;
}

export const text = (value: Localized | undefined, locale: Locale): string =>
  value ? pickText(value, locale) : "";

/**
 * Every key a search can highlight this item by (`?hl=`): its label and each thing its meta line
 * lists, in every language, cut as the API cuts them (search-text splitList).
 */
export function itemKeys(item: { label: Localized; meta?: Localized | undefined }): string {
  const keys = new Set<string>();
  for (const locale of LOCALES) {
    const label = item.label[locale];
    if (label) keys.add(matchKey(label));
    const meta = item.meta?.[locale];
    if (meta) for (const s of splitList(meta)) for (const part of s.parts) keys.add(matchKey(part));
  }
  keys.delete("");
  return [...keys].join(" ");
}

/** Tags as pills; `variant` changes only their look. */
export function Tags({
  screen,
  locale,
  variant = "pill",
}: TemplateProps & { variant?: "pill" | "slot" | "amount" }) {
  if (!screen.tags || screen.tags.length === 0) return null;
  return (
    <ul className={`${styles.tags} ${styles[variant]}`}>
      {screen.tags.map((tag, i) => (
        <li key={i} data-match-keys={itemKeys({ label: tag })}>
          {text(tag, locale)}
        </li>
      ))}
    </ul>
  );
}
