import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { at, type AdminKey } from "./copy";
import type { AdminAuthMode } from "./mode";
import { adminHref } from "./routes";
import { fakeSignOut } from "./session-actions";
import { ClerkSignOut } from "./SignOut";
import styles from "./admin.module.css";

const NAV: [string, AdminKey][] = [
  ["", "navHome"],
  ["/places", "navPlaces"],
  ["/sectors", "navSectors"],
  ["/kinds", "navKinds"],
  ["/businesses", "navBusinesses"],
  ["/plans", "navPlans"],
  ["/report", "navReport"],
];
const LOCALE_NAMES: Record<Locale, string> = { he: "עברית", ar: "العربية", en: "English" };

/** `path` is the admin path after the locale ("/places/…"), for active links and the locale switch. */
export function AdminShell({
  locale,
  path,
  mode,
  children,
}: {
  locale: Locale;
  path: string;
  mode: AdminAuthMode;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link href={adminHref(locale)} className={styles.brand}>
          {at(locale, "title")}
        </Link>
        <nav aria-label={at(locale, "title")} className={styles.nav}>
          {NAV.map(([href, key]) => {
            const active = href === "" ? path === "" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={adminHref(locale, href)}
                aria-current={active ? "page" : undefined}
                className={styles.navLink}
              >
                {at(locale, key)}
              </Link>
            );
          })}
        </nav>
        <div className={styles.tools}>
          {(["he", "ar", "en"] as const)
            .filter((l) => l !== locale)
            .map((l) => (
              <Link
                key={l}
                href={adminHref(l, path)}
                lang={l}
                hrefLang={l}
                className={styles.ghost}
              >
                {LOCALE_NAMES[l]}
              </Link>
            ))}
          {mode === "clerk" ? (
            <ClerkSignOut locale={locale} label={at(locale, "signOut")} />
          ) : (
            <form action={fakeSignOut}>
              <input type="hidden" name="locale" value={locale} />
              <button className={styles.ghost} type="submit">
                {at(locale, "signOut")}
              </button>
            </form>
          )}
        </div>
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
