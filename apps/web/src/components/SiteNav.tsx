"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
    return !/^\/(?:$|showroom|pricing|contact|join|for-business|accessibility|terms|privacy|search)(?:\/|$)/.test(
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
  const rail = useRef<HTMLUListElement>(null);
  const [mark, setMark] = useState<{ x: number; w: number } | null>(null);
  const [settled, setSettled] = useState(false);

  // One gold pill glides to the current tab (transform only), so a tab change reads as one motion.
  useLayoutEffect(() => {
    const place = () => {
      const current = rail.current?.querySelector<HTMLElement>('[aria-current="page"]');
      const tab = current?.parentElement; // the <li>, which sits directly in the rail
      if (!rail.current || !tab) return setMark(null);
      // Measured from the rail's start edge (the right one in Hebrew and Arabic).
      const rtl = getComputedStyle(rail.current).direction === "rtl";
      const end = rail.current.clientWidth - tab.offsetLeft - tab.offsetWidth;
      setMark({ x: rtl ? -end : tab.offsetLeft, w: tab.offsetWidth });
    };
    place();
    const watch = new ResizeObserver(place);
    if (rail.current) watch.observe(rail.current);
    void document.fonts?.ready.then(place);
    return () => watch.disconnect();
  }, [path]);
  useEffect(() => {
    if (!mark || settled) return;
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, [mark, settled]);

  // Close the menu when the page changes (adjusting state during render, not in an effect).
  const [openedOn, setOpenedOn] = useState(path);
  if (openedOn !== path) {
    setOpenedOn(path);
    setOpen(false);
  }
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
      <ul ref={rail} className={styles.rail}>
        {mark ? (
          <li
            aria-hidden="true"
            className={styles.pill}
            data-settled={settled ? "" : undefined}
            style={{ "--x": `${mark.x}px`, "--w": `${mark.w}px` } as CSSProperties}
          />
        ) : null}
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
            <li key={tab.href} style={{ "--i": i } as CSSProperties}>
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
