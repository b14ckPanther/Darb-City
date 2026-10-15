"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./SiteNav.module.css";

export interface NavTab {
  href: string;
  label: string;
  /** Paths (without locale) that count as this tab, beyond its own. */
  match: "home" | "city" | string;
}

const stripLocale = (path: string) => path.replace(/^\/(?:ar|en)(?=\/|$)/, "") || "/";

function isActive(tab: NavTab, path: string): boolean {
  if (tab.match === "home") return path === "/";
  if (tab.match === "city") {
    // Any city page: not one of the site's own pages.
    return !/^\/(?:$|showroom|pricing|for-business|accessibility|terms|privacy|search)(?:\/|$)/.test(
      path,
    );
  }
  return path === tab.match || path.startsWith(`${tab.match}/`);
}

/**
 * The site's tabs. Wide screens: a rail in the header, the current tab underlined in gold. Phones:
 * one button opens a full-screen list of numbered tabs (Escape or a tab closes it, focus returns).
 */
export function SiteNav({
  tabs,
  label,
  menu,
  close,
}: {
  tabs: NavTab[];
  label: string;
  menu: string;
  close: string;
}) {
  const path = stripLocale(usePathname() ?? "/");
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.setAttribute("data-nav-open", "");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.removeAttribute("data-nav-open");
    };
  }, [open]);

  return (
    <nav aria-label={label} className={styles.nav}>
      <ul className={styles.rail}>
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              className={styles.tab}
              aria-current={isActive(tab, path) ? "page" : undefined}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
      <button
        ref={button}
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.burger} aria-hidden="true" />
        <span className="visually-hidden">{open ? close : menu}</span>
      </button>
      <div id={panelId} className={styles.panel} data-open={open ? "" : undefined} hidden={!open}>
        <ol className={styles.list}>
          {tabs.map((tab, i) => (
            <li key={tab.href} style={{ "--i": i } as React.CSSProperties}>
              <Link
                href={tab.href}
                className={styles.big}
                aria-current={isActive(tab, path) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <span className={styles.index} aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {tab.label}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
