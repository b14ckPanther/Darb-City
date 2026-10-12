import { pickText, type Locale, type Localized } from "@darb/core";
import type { ScreenDto } from "@darb/contracts";
import styles from "./templates.module.css";

export interface TemplateProps {
  screen: ScreenDto;
  locale: Locale;
}

export const text = (value: Localized | undefined, locale: Locale): string =>
  value ? pickText(value, locale) : "";

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
        <li key={i}>{text(tag, locale)}</li>
      ))}
    </ul>
  );
}
