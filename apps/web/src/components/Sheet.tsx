"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { DESKTOP, useMedia } from "@/lib/use-media";
import styles from "./Sheet.module.css";

export type Snap = "peek" | "half" | "full";
const ORDER: readonly Snap[] = ["peek", "half", "full"];
const DRAG_THRESHOLD = 60;
const DISMISS_DRAG = 120;

/**
 * Makes everything behind `root` inert: every sibling of it and of each ancestor up to <body>
 * (skip link, header, city bar, list, …). Returns the undo, which leaves alone anything that was
 * already inert.
 */
export function inertBackground(root: HTMLElement): () => void {
  const changed: Element[] = [];
  for (let node: HTMLElement | null = root; node && node !== document.body;) {
    const parent: HTMLElement | null = node.parentElement;
    for (const sibling of parent?.children ?? []) {
      if (sibling === node || sibling.hasAttribute("inert")) continue;
      sibling.setAttribute("inert", "");
      changed.push(sibling);
    }
    node = parent;
  }
  return () => {
    for (const el of changed) el.removeAttribute("inert");
  };
}

/** Enter and Space on the handle: peek → half → full → peek. */
export function cycleSnap(current: Snap): Snap {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!;
}

export function nextSnap(current: Snap, direction: 1 | -1): Snap {
  const i = Math.min(ORDER.length - 1, Math.max(0, ORDER.indexOf(current) + direction));
  return ORDER[i]!;
}

/** Dragging up (negative) opens further, dragging down closes further. */
export function snapFromDrag(current: Snap, deltaY: number): Snap {
  if (deltaY < -DRAG_THRESHOLD) return nextSnap(current, 1);
  if (deltaY > DRAG_THRESHOLD) return nextSnap(current, -1);
  return current;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

const noSubscription = () => () => {};

/**
 * True once the sheet may live in <body>: on any client render except hydration. The server (and
 * so hydration) puts it in the page where it is declared, inside `.city`.
 */
const useInBody = () =>
  useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

export interface SheetProps {
  /** Level 3: where closing goes. */
  closeHref: string;
  labelledBy: string;
  /** `data-business-link` key of the row that opens this sheet. */
  returnFocusTo: string;
  /** `resize` names the handle with the current snap, e.g. "Resize, half". */
  labels: { close: string; resize: Record<Snap, string> };
  children: ReactNode;
}

export function Sheet({ closeHref, labelledBy, returnFocusTo, labels, children }: SheetProps) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ startY: number } | null>(null);
  const [snap, setSnap] = useState<Snap>("half");
  const desktop = useMedia(DESKTOP);
  // A portal into <body>, so the sheet's z-index competes with the site header's rather than being
  // capped by `.city`'s stacking context. A server-rendered sheet hydrates in place and then moves
  // there; it skips its entrance (it is already on screen), and focus follows it.
  const inBody = useInBody();
  const [fromServer] = useState(() => !inBody);
  const [settling, setSettling] = useState(fromServer);

  const close = () => router.push(closeHref, { scroll: false });
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  // Phone: a modal bottom sheet over the city. Desktop: a non-modal side panel beside the list
  // and the map, which stay usable (Plan 2A ruling I5).
  useEffect(() => {
    if (desktop || !root.current) return;
    return inertBackground(root.current);
  }, [desktop, inBody]);

  // A hydrated sheet just moved into <body>: its old node took focus with it.
  useEffect(() => {
    if (!fromServer || !inBody) return;
    if (!root.current?.contains(document.activeElement)) closeButton.current?.focus();
    const frame = requestAnimationFrame(() => setSettling(false));
    return () => cancelAnimationFrame(frame);
  }, [fromServer, inBody]);

  useEffect(() => {
    closeButton.current?.focus();
    // On the document, so Escape works wherever focus is (even if it left the panel), unless
    // something else (a menu, the map) already handled this Escape.
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      closeRef.current();
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
      const row = document.querySelector<HTMLElement>(`[data-business-link="${returnFocusTo}"]`);
      (row ?? document.getElementById("main-heading"))?.focus();
    };
  }, [returnFocusTo]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panel.current) return;
    const items = focusables(panel.current);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onHandleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      // Handled here (not as a click) so a drag that ends on the handle never cycles.
      event.preventDefault();
      setSnap(cycleSnap);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSnap((s) => nextSnap(s, 1));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSnap((s) => nextSnap(s, -1));
    }
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    drag.current = { startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    panel.current?.setAttribute("data-dragging", "");
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    panel.current?.style.setProperty("--drag", `${event.clientY - drag.current.startY}px`);
  }

  function onPointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const deltaY = event.clientY - drag.current.startY;
    drag.current = null;
    panel.current?.removeAttribute("data-dragging");
    panel.current?.style.removeProperty("--drag");
    if (snap === "peek" && deltaY > DISMISS_DRAG) close();
    else setSnap((s) => snapFromDrag(s, deltaY));
  }

  const sheet = (
    <div
      ref={root}
      className={styles.root}
      data-sheet=""
      data-settled={fromServer && inBody && settling ? "" : undefined}
    >
      {desktop ? null : <div className={styles.scrim} aria-hidden="true" onClick={close} />}
      <div
        ref={panel}
        role="dialog"
        aria-modal={desktop ? undefined : "true"}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={styles.panel}
        data-snap={snap}
        onKeyDown={onKeyDown}
      >
        <div className={styles.top}>
          <span aria-hidden="true" />
          <button
            type="button"
            className={styles.handle}
            aria-label={labels.resize[snap]}
            data-sheet-handle=""
            onKeyDown={onHandleKey}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          />
          <button
            ref={closeButton}
            type="button"
            className={styles.close}
            aria-label={labels.close}
            data-sheet-close=""
            onClick={close}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
  return inBody ? createPortal(sheet, document.body) : sheet;
}
