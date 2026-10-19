"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";
import { AdminIcon } from "./AdminIcon";
import type { PaletteLabels } from "./CommandPalette";
import { adminHintCookie } from "./marker";
import type { PaletteHit } from "./palette";
import { TOAST_EVENT, type Toast } from "./toast";
import styles from "./shell.module.css";

/** Loaded on the first ⌘K or tap on search, never with the page. */
const CommandPalette = dynamic(() => import("./CommandPalette"), { ssr: false });

import { RAIL_COOKIE } from "./nav";

const OPEN_PALETTE = "darb-admin-palette";
const noSubscribe = () => () => {};
function subscribeTheme(change: () => void) {
  const attr = new MutationObserver(change);
  attr.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener("change", change);
  return () => {
    attr.disconnect();
    media?.removeEventListener("change", change);
  };
}

/**
 * The search buttons and the keyboard (⌘K, Ctrl+K, and "/" outside a field) all open the same
 * palette. It is mounted once, by the shell.
 */
export function PaletteHost({
  locale,
  statics,
  labels,
}: {
  locale: string;
  statics: PaletteHit[];
  labels: PaletteLabels;
}) {
  const [open, setOpen] = useState(false);
  const back = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const show = () => {
      back.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (open) return;
        show();
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE, show);
    };
  }, [open]);
  if (!open) return null;
  return (
    <CommandPalette
      locale={locale}
      statics={statics}
      labels={labels}
      onClose={() => {
        setOpen(false);
        back.current?.focus?.();
      }}
    />
  );
}

export function SearchButton({
  label,
  className,
  showKeys = false,
  children,
}: {
  label: string;
  className?: string;
  showKeys?: boolean;
  children?: ReactNode;
}) {
  const mac = useSyncExternalStore(
    noSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true,
  );
  return (
    <button
      type="button"
      className={className}
      aria-keyshortcuts="Control+K Meta+K"
      aria-label={children ? undefined : label}
      onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}
      data-open-palette=""
    >
      <AdminIcon name="search" />
      {children}
      {showKeys ? (
        <kbd className={styles.kbd} aria-hidden="true">
          {mac ? "⌘K" : "Ctrl K"}
        </kbd>
      ) : null}
    </button>
  );
}

/** Folds the sidebar into a rail of icons; remembered in a cookie so the server draws it right. */
export function RailToggle({
  rail,
  labels,
}: {
  rail: boolean;
  labels: { fold: string; unfold: string };
}) {
  const [folded, setFolded] = useState(rail);
  return (
    <button
      type="button"
      className={styles.sideButton}
      aria-pressed={folded}
      aria-label={folded ? labels.unfold : labels.fold}
      title={folded ? labels.unfold : labels.fold}
      onClick={() => {
        const next = !folded;
        setFolded(next);
        document.querySelector("[data-admin-shell]")?.toggleAttribute("data-rail", next);
        document.cookie = `${RAIL_COOKIE}=${next ? "1" : ""}; path=/; max-age=${next ? 31536000 : 0}; samesite=lax`;
      }}
      data-rail-toggle=""
    >
      <AdminIcon name="rail" className={styles.railIcon} />
      <span className={styles.sideLabel}>{folded ? labels.unfold : labels.fold}</span>
    </button>
  );
}

/** Day or night for the admin, the same pick the public site remembers. */
export function ThemeButton({
  labels,
  className,
}: {
  labels: { toDark: string; toLight: string };
  className?: string;
}) {
  // The page's scheme: the visitor's pick, else the device's; follows the toggle and the device.
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => null);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? labels.toDark : labels.toLight;
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        applyTheme(next);
      }}
      title={label}
      data-theme-button=""
    >
      <AdminIcon name={next === "dark" ? "moon" : "sun"} />
      <span className={styles.sideLabel}>{label}</span>
    </button>
  );
}

/** The phone's More sheet: everything not on the bottom bar. A modal dialog. */
export function MoreSheet({
  label,
  closeLabel,
  className,
  children,
}: {
  label: string;
  closeLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
        data-more-button=""
      >
        <AdminIcon name="menu" />
        <span>{label}</span>
      </button>
      <dialog
        ref={ref}
        className={styles.sheet}
        aria-label={label}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          // A tap on the backdrop or on any link closes it.
          if (t === ref.current || t.closest("a")) ref.current?.close();
        }}
      >
        <div className={styles.sheetHead}>
          <strong>{label}</strong>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => ref.current?.close()}
            aria-label={closeLabel}
          >
            <AdminIcon name="close" />
          </button>
        </div>
        {children}
      </dialog>
    </>
  );
}

/** Toasts: short, polite, gone after a few seconds (errors stay a little longer). */
export function Toaster() {
  const [items, setItems] = useState<(Toast & { id: number })[]>([]);
  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const t = (e as CustomEvent<Toast>).detail;
      const id = ++n;
      setItems((all) => [...all.slice(-2), { ...t, id }]);
      setTimeout(
        () => setItems((all) => all.filter((x) => x.id !== id)),
        t.tone === "error" ? 7000 : 4000,
      );
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);
  return (
    <div className={styles.toasts} role="status" aria-live="polite" data-toasts="">
      {items.map((t) => (
        <p key={t.id} className={styles.toast} data-tone={t.tone ?? "ok"}>
          <AdminIcon name={t.tone === "error" ? "alert" : "check"} size={18} />
          {t.message}
        </p>
      ))}
    </div>
  );
}

/** Tells the public site this browser may belong to an admin (see marker.ts); grants nothing. */
export function AdminMarker() {
  useEffect(() => {
    document.cookie = adminHintCookie(location.protocol === "https:");
  }, []);
  return null;
}
