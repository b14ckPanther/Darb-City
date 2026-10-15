import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@darb/core";
import { LOCALES } from "@darb/core";
import { t } from "@darb/i18n";
import { footer, SOCIAL } from "@/content/footer";
import { href, paths } from "@/lib/routes";
import styles from "./Footer.module.css";

const LANGUAGE_NAMES: Record<Locale, string> = { he: "עברית", ar: "العربية", en: "English" };

function Icon({ name }: { name: keyof typeof SOCIAL }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  switch (name) {
    case "darbInstagram":
    case "founderInstagram":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common} fill="currentColor">
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm7 0h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06C21.6 9.04 22 11.3 22 14.2V21h-4v-6c0-1.43-.03-3.27-2-3.27-2 0-2.3 1.56-2.3 3.17V21h-4V9.5Z" />
        </svg>
      );
    case "github":
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
        </svg>
      );
    case "email":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "portfolio":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
        </svg>
      );
  }
}

/** The site footer: the path's links, Darb's channels and the founder's. */
export function Footer({
  locale,
  segments = [],
}: {
  locale: Locale;
  segments?: readonly string[];
}) {
  const copy = footer[locale];
  const year = new Date().getFullYear();
  const explore = [
    { label: copy.links.explore, to: href(locale, paths.explore()) },
    { label: copy.links.search, to: href(locale, paths.search()) },
    { label: copy.links.showroom, to: href(locale, paths.showroom()) },
    { label: copy.links.pricing, to: href(locale, paths.pricing()) },
    { label: t(locale, "forBusiness"), to: href(locale, paths.forBusiness()) },
  ];
  const darb = (["darbInstagram", "email"] as const).map((key) => ({ key, ...SOCIAL[key] }));
  const founder = (["portfolio", "founderInstagram", "linkedin", "github"] as const).map((key) => ({
    key,
    ...SOCIAL[key],
  }));
  return (
    <footer className={styles.footer}>
      <div className={`frame ${styles.inner}`}>
        <div className={styles.brand}>
          <Link href={href(locale)} className={styles.logo} aria-label={t(locale, "appName")}>
            <Image src="/brand/darb-mark-96.webp" alt="" width={44} height={51} unoptimized />
            <span className={styles.wordmark} aria-hidden="true">
              <span lang="en">Darb</span>
              <span className={styles.slash}>/</span>
              <span lang="ar">درب</span>
            </span>
          </Link>
          <p className={styles.motto}>{copy.motto}</p>
          <a className={styles.cta} href={SOCIAL.email.href}>
            {copy.cta}
          </a>
        </div>

        <nav aria-label={copy.exploreTitle} className={styles.column}>
          <h2 className={styles.heading}>{copy.exploreTitle}</h2>
          <ul>
            {explore.map((l) => (
              <li key={l.to}>
                <Link href={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.column}>
          <h2 className={styles.heading}>{copy.darbTitle}</h2>
          <ul>
            {darb.map((l) => (
              <li key={l.key}>
                <a href={l.href} rel={l.href.startsWith("http") ? "noopener" : undefined}>
                  <Icon name={l.key} />
                  <bdi dir="ltr">{l.handle}</bdi>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.column}>
          <h2 className={styles.heading}>{copy.founderTitle}</h2>
          <ul>
            {founder.map((l) => (
              <li key={l.key}>
                <a href={l.href} rel="noopener">
                  <Icon name={l.key} />
                  <bdi dir="ltr">{l.handle}</bdi>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={`frame ${styles.base}`}>
        <p>
          © {year} <span lang="en">Darb</span> · {copy.rights}
        </p>
        <ul className={styles.legal}>
          <li>
            <Link href={href(locale, paths.accessibility())}>{copy.legal.accessibility}</Link>
          </li>
          <li>
            <Link href={href(locale, paths.terms())}>{copy.legal.terms}</Link>
          </li>
          <li>
            <Link href={href(locale, paths.privacy())}>{copy.legal.privacy}</Link>
          </li>
        </ul>
        <ul className={styles.languages} aria-label={copy.languages}>
          {LOCALES.map((l) => (
            <li key={l}>
              <Link
                href={href(l, segments)}
                lang={l}
                hrefLang={l}
                aria-current={l === locale ? "true" : undefined}
              >
                {LANGUAGE_NAMES[l]}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.giant} aria-hidden="true">
        <span lang="en">Darb</span> · <span lang="ar">درب</span> · <span lang="he">דרב</span>
      </p>
    </footer>
  );
}
