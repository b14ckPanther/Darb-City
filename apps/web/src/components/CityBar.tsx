import Link from "next/link";
import { LOCALES, type Locale } from "@darb/core";
import { t } from "@darb/i18n";
import type { Crumb } from "@/lib/crumbs";
import { href } from "@/lib/routes";
import styles from "./CityBar.module.css";

const LANGUAGE_NAMES: Record<Locale, string> = { he: "עברית", ar: "العربية", en: "English" };

export function LocaleSwitch({
  locale,
  segments,
}: {
  locale: Locale;
  segments: readonly string[];
}) {
  return (
    <nav aria-label={t(locale, "language")} className={styles.locales} data-locale-switch="">
      <ul>
        {LOCALES.map((l) => (
          <li key={l}>
            <Link
              href={href(l, segments)}
              hrefLang={l}
              lang={l}
              prefetch={false}
              aria-current={l === locale ? "true" : undefined}
              className={styles.locale}
            >
              {LANGUAGE_NAMES[l]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The chevron and arrow point along the reading direction; `.flip` mirrors them in RTL. */
export function PathBar({ locale, crumbs }: { locale: Locale; crumbs: Crumb[] }) {
  const up = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;
  return (
    <nav aria-label={t(locale, "pathBar")} className={styles.path} data-path-bar="">
      {up ? (
        <Link href={up.href} className={styles.up} aria-label={t(locale, "upOneLevel")} data-up="">
          <svg
            className={styles.flip}
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
          >
            <path
              d="M15 6l-6 6 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      ) : null}
      <ol className={styles.crumbs}>
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={crumb.href} className={styles.crumb}>
              {i > 0 ? (
                <svg
                  className={`${styles.chevron} ${styles.flip}`}
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  aria-hidden="true"
                >
                  <path
                    d="M9 6l6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
              {last ? (
                <span aria-current="page" className={styles.current}>
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className={styles.link}>
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function CityBar({
  locale,
  crumbs,
  segments,
}: {
  locale: Locale;
  crumbs: Crumb[];
  segments: readonly string[];
}) {
  return (
    <div id="city-bar" className={`frame ${styles.bar}`}>
      <PathBar locale={locale} crumbs={crumbs} />
      <LocaleSwitch locale={locale} segments={segments} />
    </div>
  );
}
