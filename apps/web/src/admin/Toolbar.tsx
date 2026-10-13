import Link from "next/link";
import type { Locale } from "@darb/core";
import { at } from "./copy";
import styles from "./admin.module.css";

export interface ToolbarSelect {
  name: string;
  label: string;
  value?: string;
  options: [string, string][];
}

/** A plain GET form: works without JavaScript, and the URL is the state (shareable, reloadable). */
export function Toolbar({
  locale,
  action,
  q,
  selects = [],
}: {
  locale: Locale;
  action: string;
  q?: string;
  selects?: ToolbarSelect[];
}) {
  return (
    <form method="get" action={action} className={styles.toolbar} role="search">
      <label className={styles.field}>
        <span>{at(locale, "search")}</span>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={at(locale, "searchPlaceholder")}
          dir="auto"
        />
      </label>
      {selects.map((s) => (
        <label key={s.name} className={styles.field}>
          <span id={`filter-${s.name}`}>{s.label}</span>
          <select name={s.name} defaultValue={s.value ?? ""} aria-labelledby={`filter-${s.name}`}>
            <option value="">{at(locale, "all")}</option>
            {s.options.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button type="submit" className={styles.ghost}>
        {at(locale, "search")}
      </button>
    </form>
  );
}

export function Pager({ locale, href }: { locale: Locale; href: string | null }) {
  return href ? (
    <p className={styles.actions}>
      <Link href={href} className={styles.ghost}>
        {at(locale, "nextPage")}
      </Link>
    </p>
  ) : null;
}
