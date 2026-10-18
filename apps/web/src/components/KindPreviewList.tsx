"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { previewStore, type Preview } from "@/lib/map-focus";

/** A row must hold the pointer this long before the map follows: sweeping past never thrashes. */
const INTENT_MS = 120;
/** Leaving the list clears a hovered preview after this grace (a short trip to the map is fine). */
const LEAVE_MS = 320;
/**
 * Shared by every list on the page (a place has one per sector): moving from one sector's rows to
 * the next cancels the first list's pending clear.
 */
const timers = { intent: 0, leave: 0 };

function previewOf(place: string, li: Element, sticky: boolean): Preview | null {
  const kind = li.getAttribute("data-kind-row");
  if (!kind) return null;
  return {
    place,
    kind,
    title: li.getAttribute("data-title") ?? "",
    count: Number(li.getAttribute("data-count") ?? 0),
    sticky,
  };
}

/**
 * The category rows of a place's list, wired to the map: hovering or focusing a row previews its
 * businesses on the map, the row's map button chooses it (and opens the map on a phone), and the
 * row being shown stays marked. One set of delegated listeners for every row: the rows themselves
 * are server-rendered and ship no JavaScript.
 */
export function KindPreviewList({
  place,
  label,
  className,
  style,
  children,
}: {
  place: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const ul = list.current;
    if (!ul) return;
    const rowAt = (target: EventTarget | null) =>
      target instanceof Element ? target.closest("[data-kind-row]") : null;
    const show = (li: Element, sticky = false) => {
      window.clearTimeout(timers.leave);
      const next = previewOf(place, li, sticky);
      const now = previewStore.get();
      // A chosen category stays until another is chosen; hovering only previews when none is.
      if (next && (sticky || !now?.sticky)) previewStore.set(next);
    };
    const clearSoon = () => {
      window.clearTimeout(timers.intent);
      window.clearTimeout(timers.leave);
      timers.leave = window.setTimeout(() => {
        if (!previewStore.get()?.sticky) previewStore.set(null);
      }, LEAVE_MS);
    };
    const onOver = (event: PointerEvent) => {
      // Touch has no hover: a tap is a navigation or the map button, never a preview by accident.
      if (event.pointerType !== "mouse") return;
      const li = rowAt(event.target);
      if (!li) return;
      window.clearTimeout(timers.intent);
      window.clearTimeout(timers.leave);
      timers.intent = window.setTimeout(() => show(li), INTENT_MS);
    };
    const onFocus = (event: FocusEvent) => {
      const li = rowAt(event.target);
      if (li && (event.target as Element).matches(":focus-visible")) show(li);
    };
    const onBlur = (event: FocusEvent) => {
      if (!ul.contains(event.relatedTarget as Node | null)) clearSoon();
    };
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest("[data-kind-preview]");
      const li = rowAt(button ?? null);
      if (!button || !li) return;
      const now = previewStore.get();
      // The map button chooses the row; pressing it again (where the map is beside the list) lets go.
      if (now?.sticky && now.kind === li.getAttribute("data-kind-row")) previewStore.set(null);
      else show(li, true);
    };
    const mark = () => {
      const now = previewStore.get();
      for (const li of ul.querySelectorAll("[data-kind-row]")) {
        const on = now?.place === place && now.kind === li.getAttribute("data-kind-row");
        li.toggleAttribute("data-previewing", on);
        li.querySelector("[data-kind-preview]")?.setAttribute(
          "aria-pressed",
          String(on && now.sticky),
        );
      }
    };
    ul.addEventListener("pointerover", onOver);
    ul.addEventListener("pointerleave", clearSoon);
    ul.addEventListener("focusin", onFocus);
    ul.addEventListener("focusout", onBlur);
    ul.addEventListener("click", onClick);
    const stop = previewStore.subscribe(mark);
    mark();
    return () => {
      window.clearTimeout(timers.intent);
      window.clearTimeout(timers.leave);
      ul.removeEventListener("pointerover", onOver);
      ul.removeEventListener("pointerleave", clearSoon);
      ul.removeEventListener("focusin", onFocus);
      ul.removeEventListener("focusout", onBlur);
      ul.removeEventListener("click", onClick);
      stop();
      // The list is gone (a new page): its preview goes with it.
      if (previewStore.get()?.place === place) previewStore.set(null);
    };
  }, [place]);

  return (
    <ul ref={list} className={className} style={style} aria-label={label}>
      {children}
    </ul>
  );
}
