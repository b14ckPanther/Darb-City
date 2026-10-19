import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { DOOR_PATH } from "@darb/tokens";
import { AdminIcon } from "./AdminIcon";
import { AppBadge } from "./AppBadge";
import { at, type AdminKey } from "./copy";
import type { AdminAuthMode } from "./mode";
import { NAV, NAV_ITEMS, type NavItem } from "./nav";
import type { PaletteHit } from "./palette";
import { adminHref } from "./routes";
import { fakeSignOut } from "./session-actions";
import {
  AdminMarker,
  MoreSheet,
  NavLink,
  PaletteHost,
  RailToggle,
  SearchButton,
  ThemeButton,
  Toaster,
} from "./ShellControls";
import { ClerkSignOut } from "./SignOut";
import styles from "./shell.module.css";

/** The Darb doorway on forest: the admin's mark in the sidebar and the phone's top bar. */
function DarbMark() {
  return (
    <span className={styles.brandMark} aria-hidden="true">
      <svg viewBox="0 0 100 150" width="14" height="21">
        <path d={DOOR_PATH} fill="currentColor" />
      </svg>
    </span>
  );
}

const LOCALE_NAMES: Record<Locale, string> = { he: "עברית", ar: "العربية", en: "English" };
const LOCALES: Locale[] = ["he", "ar", "en"];

/** What the palette offers before anything is typed: every screen, then the quick actions. */
function paletteStatics(locale: Locale): PaletteHit[] {
  const screens = NAV_ITEMS.map((i): PaletteHit => ({
    id: `nav${i.href || "/"}`,
    group: "palettePages",
    label: at(locale, i.label),
    href: adminHref(locale, i.href),
    icon: i.icon,
  }));
  const actions: [string, AdminKey][] = [
    ["/businesses/new", "newBusiness"],
    ["/places/new", "newPlace"],
    ["/kinds/new", "newKind"],
    ["/sectors/new", "newSector"],
    ["/plans/texts", "pageTexts"],
  ];
  return [
    ...screens,
    ...actions.map(([href, key]): PaletteHit => ({
      id: `act${href}`,
      group: "paletteActions",
      label: at(locale, key),
      href: adminHref(locale, href),
      icon: href.endsWith("/texts") ? "edit" : "plus",
    })),
  ];
}

/**
 * The admin's frame. Desktop: a grouped sidebar (folds to an icon rail) and the page. Phone: a
 * slim top bar with search, the page, and a bottom bar with the five most used places plus More.
 * `path` is the admin path after the locale, for the current item and the language switch.
 */
export function AdminShell({
  locale,
  path,
  mode,
  rail = false,
  newInquiries = 0,
  pendingJoins = 0,
  waitingHelpers = 0,
  children,
}: {
  locale: Locale;
  path: string;
  mode: AdminAuthMode;
  rail?: boolean;
  newInquiries?: number;
  pendingJoins?: number;
  /** People who applied to be helpers and wait for an answer. */
  waitingHelpers?: number;
  children: ReactNode;
}) {
  const t = (key: AdminKey, vars?: Record<string, string | number>) => at(locale, key, vars);
  const count = (item: NavItem) =>
    item.badge === "joins"
      ? pendingJoins
      : item.badge === "inquiries"
        ? newInquiries
        : item.badge === "helpers"
          ? waitingHelpers
          : 0;
  const countLabel = (item: NavItem, n: number) =>
    item.badge === "joins"
      ? t("joinPendingCount", { count: n })
      : item.badge === "helpers"
        ? t("helpersWaitingCount", { count: n })
        : t("inquiryNewCount", { count: n });

  const link = (
    item: NavItem,
    className: string | undefined,
    variant: "side" | "tab" | "sheet",
  ) => {
    const n = count(item);
    const label = t(item.label);
    return (
      <NavLink
        key={`${variant}${item.href}`}
        href={adminHref(locale, item.href)}
        item={item.href}
        className={className}
        title={variant === "side" ? label : undefined}
        data-nav={item.href || "/"}
      >
        <span className={styles.navIcon}>
          <AdminIcon name={item.icon} />
          {n > 0 ? (
            <span className={styles.count} aria-hidden="true">
              {n > 99 ? "99+" : n}
            </span>
          ) : null}
        </span>
        <span className={variant === "side" ? styles.sideLabel : undefined}>
          {variant === "tab" && item.short ? t(item.short) : label}
        </span>
        {n > 0 ? <span className={styles.srOnly}>, {countLabel(item, n)}</span> : null}
      </NavLink>
    );
  };

  const languages = (
    <div className={styles.langs} role="group" aria-label={t("languageSwitch")}>
      {LOCALES.map((l) =>
        l === locale ? (
          <span key={l} className={styles.lang} aria-current="true" lang={l}>
            {LOCALE_NAMES[l]}
          </span>
        ) : (
          <Link key={l} href={adminHref(l, path)} lang={l} hrefLang={l} className={styles.lang}>
            {LOCALE_NAMES[l]}
          </Link>
        ),
      )}
    </div>
  );

  const signOut =
    mode === "clerk" ? (
      <ClerkSignOut locale={locale} label={t("signOut")} className={styles.sideButton} />
    ) : (
      <form action={fakeSignOut}>
        <input type="hidden" name="locale" value={locale} />
        <button className={styles.sideButton} type="submit" title={t("signOut")}>
          <AdminIcon name="signOut" />
          <span className={styles.sideLabel}>{t("signOut")}</span>
        </button>
      </form>
    );

  return (
    <div className={styles.shell} data-admin-shell="" data-rail={rail ? "" : undefined}>
      <a href="#main" className={styles.skip}>
        {t("skipToContent")}
      </a>

      <aside className={styles.side}>
        <div className={styles.sideTop}>
          <Link href={adminHref(locale)} className={styles.brand} title={t("title")}>
            <DarbMark />
            <span className={styles.sideLabel}>{t("title")}</span>
          </Link>
          <SearchButton label={t("openSearch")} className={styles.searchButton} showKeys>
            <span className={styles.sideLabel}>{t("openSearch")}</span>
          </SearchButton>
        </div>
        <nav aria-label={t("mainNav")} className={styles.sideNav}>
          {NAV.map((g) => (
            <div key={g.label} className={styles.group}>
              <p className={styles.groupLabel} aria-hidden="true">
                {t(g.label)}
              </p>
              <ul role="list" aria-label={t(g.label)}>
                {g.items.map((item) => (
                  <li key={item.href}>{link(item, styles.navLink, "side")}</li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className={styles.sideFoot}>
          <div className={styles.sideLangs}>{languages}</div>
          <ThemeButton
            className={styles.sideButton}
            labels={{ toDark: t("toNight"), toLight: t("toDay") }}
          />
          {signOut}
          <RailToggle rail={rail} labels={{ fold: t("foldNav"), unfold: t("unfoldNav") }} />
        </div>
      </aside>

      <header className={styles.topbar}>
        <Link href={adminHref(locale)} className={styles.brand}>
          <DarbMark />
          <span>{t("title")}</span>
        </Link>
        <SearchButton label={t("openSearch")} className={styles.iconButton} />
      </header>

      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>

      <nav aria-label={t("tabNav")} className={styles.tabbar}>
        {NAV_ITEMS.filter((i) => i.tab).map((item) => link(item, styles.tab, "tab"))}
        <MoreSheet label={t("more")} closeLabel={t("close")} className={styles.tab}>
          <nav aria-label={t("mainNav")} className={styles.sheetNav}>
            {NAV.map((g) => (
              <div key={g.label} className={styles.group}>
                <p className={styles.groupLabel} aria-hidden="true">
                  {t(g.label)}
                </p>
                <ul role="list" aria-label={t(g.label)}>
                  {g.items.map((item) => (
                    <li key={item.href}>{link(item, styles.navLink, "sheet")}</li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className={styles.sheetFoot}>
            {languages}
            <ThemeButton
              className={styles.sideButton}
              labels={{ toDark: t("toNight"), toLight: t("toDay") }}
            />
            {signOut}
          </div>
        </MoreSheet>
      </nav>

      <PaletteHost
        locale={locale}
        statics={paletteStatics(locale)}
        labels={{
          title: t("paletteLabel"),
          placeholder: t("palettePlaceholder"),
          empty: t("paletteEmpty"),
          searching: t("paletteSearching"),
          error: t("paletteError"),
          keys: t("paletteKeys"),
          close: t("close"),
          groups: Object.fromEntries(
            (
              [
                "palettePages",
                "paletteActions",
                "paletteBusinesses",
                "palettePlaces",
                "paletteKinds",
                "paletteSectors",
              ] as const
            ).map((k) => [k, t(k)]),
          ),
        }}
      />
      <Toaster />
      <AdminMarker />
      {/* The installed app's icon: requests and helpers waiting for an answer. */}
      <AppBadge count={pendingJoins + waitingHelpers} />
    </div>
  );
}
