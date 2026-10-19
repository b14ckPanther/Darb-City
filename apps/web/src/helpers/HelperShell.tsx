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
/** The tabs' glyphs: a camera with a plus, a stack of cards, a person. Never the arch. */
const ICON: Record<HelperTab, string> = {
  add: "M9 4 7.6 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2.6L15 4H9Zm3 5v3m0 0v3m0-3H9m3 0h3",
  mine: "M4 6h16M4 12h16M4 18h10",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5",
};
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
              <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" focusable="false">
                <path
                  d={ICON[key]}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{ht(locale, label)}</span>
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
