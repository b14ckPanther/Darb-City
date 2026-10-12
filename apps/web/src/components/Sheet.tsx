"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import styles from "./Sheet.module.css";

export type Snap = "peek" | "half" | "full";
const ORDER: readonly Snap[] = ["peek", "half", "full"];
const DRAG_THRESHOLD = 60;
const DISMISS_DRAG = 120;

/** Everything behind the sheet; made inert while it is open. */
export const SHEET_BACKGROUND_IDS = ["site-header", "city-bar", "city-list"] as const;

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

export interface SheetProps {
  /** Level 3: where closing goes. */
  closeHref: string;
  labelledBy: string;
  /** `data-business-link` key of the row that opens this sheet. */
  returnFocusTo: string;
  labels: { close: string; resize: string };
  children: ReactNode;
}

export function Sheet({ closeHref, labelledBy, returnFocusTo, labels, children }: SheetProps) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ startY: number } | null>(null);
  const [snap, setSnap] = useState<Snap>("half");

  useEffect(() => {
    const background = SHEET_BACKGROUND_IDS.map((id) => document.getElementById(id));
    for (const el of background) el?.setAttribute("inert", "");
    closeButton.current?.focus();
    return () => {
      for (const el of background) el?.removeAttribute("inert");
      const row = document.querySelector<HTMLElement>(`[data-business-link="${returnFocusTo}"]`);
      (row ?? document.getElementById("main-heading"))?.focus();
    };
  }, [returnFocusTo]);

  const close = () => router.push(closeHref, { scroll: false });

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
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
    if (event.key === "ArrowUp") {
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

  return (
    <div className={styles.root} data-sheet="">
      <div className={styles.scrim} aria-hidden="true" onClick={close} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={styles.panel}
        data-snap={snap}
        onKeyDown={onKeyDown}
      >
        <div className={styles.top}>
          <span aria-hidden="true" />
          <button
            type="button"
            className={styles.handle}
            aria-label={labels.resize}
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
}
