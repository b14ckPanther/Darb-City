import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { adminAuthMode } from "@/admin/mode";
import { fakeHelperSignOut } from "./actions";
import { ht, type HelperKey } from "./copy";
import { helperHref } from "./routes";
import { ClerkHelperSignOut } from "./SignOut";
import styles from "./helpers.module.css";

export type HelperTab = "add" | "mine" | "profile";
const TABS: [HelperTab, string, HelperKey][] = [
  ["add", "", "navAdd"],
  ["mine", "/mine", "navMine"],
  ["profile", "/profile", "navProfile"],
];

/**
 * The helper app's frame: the Darb mark and the app's name on top, the screen, and (for helpers who
 * may add or read their list) the three tabs at the bottom, within thumb's reach.
 */
export function HelperShell({
  locale,
  tab,
  tabs = false,
  children,
}: {
  locale: Locale;
  tab?: HelperTab;
  tabs?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.app} data-tabs={tabs ? "" : undefined}>
      <header className={styles.top}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the approved raster mark, never redrawn */}
        <img src="/brand/darb-mark-96.webp" alt="" width={24} height={28} />
        <span className={styles.appName}>{ht(locale, "title")}</span>
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
      {tabs ? (
        <nav className={styles.tabs} aria-label={ht(locale, "navLabel")}>
          {TABS.map(([key, path, label]) => (
            <Link
              key={key}
              href={helperHref(locale, path)}
              className={styles.tab}
              aria-current={tab === key ? "page" : undefined}
            >
              {ht(locale, label)}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

/** Sign out: Clerk's own button, or the local e2e cookie's form. */
export function HelperSignOut({ locale, className }: { locale: Locale; className?: string }) {
  const label = ht(locale, "signOut");
  if (adminAuthMode() === "clerk")
    return <ClerkHelperSignOut locale={locale} label={label} className={className} />;
  return (
    <form action={fakeHelperSignOut}>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
