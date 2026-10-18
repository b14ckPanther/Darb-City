"use client";

import { useEffect, type RefObject } from "react";
import { hotStore } from "@/lib/map-focus";

/**
 * A business list and its numbered pins as one thing: hovering or focusing a row lifts its pin on
 * the map, and hovering a pin lifts its row (data-hot). One set of delegated listeners on the
 * list's container; the rows stay plain server-rendered markup. `shown`: the container is on the
 * page (a list that can be empty mounts it later).
 */
export function useMapRows(container: RefObject<HTMLElement | null>, shown = true): void {
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const keyAt = (target: EventTarget | null) =>
      target instanceof Element
        ? (target.closest("[data-business]")?.getAttribute("data-business") ?? null)
        : null;
    const lift = (key: string | null) => {
      if (key) hotStore.set({ key, from: "list" });
      else if (hotStore.get()?.from === "list") hotStore.set(null);
    };
    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "mouse") lift(keyAt(event.target));
    };
    const onLeave = () => lift(null);
    const onFocus = (event: FocusEvent) => lift(keyAt(event.target));
    const onBlur = (event: FocusEvent) => {
      if (!root.contains(event.relatedTarget as Node | null)) lift(null);
    };
    let marked: Element | null = null;
    const mark = () => {
      const key = hotStore.get()?.key;
      const row = key ? root.querySelector(`[data-business="${CSS.escape(key)}"]`) : null;
      if (row === marked) return;
      marked?.removeAttribute("data-hot");
      row?.setAttribute("data-hot", "");
      marked = row;
    };
    root.addEventListener("pointerover", onOver);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("focusin", onFocus);
    root.addEventListener("focusout", onBlur);
    const stop = hotStore.subscribe(mark);
    mark();
    return () => {
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("focusin", onFocus);
      root.removeEventListener("focusout", onBlur);
      stop();
      marked?.removeAttribute("data-hot");
      hotStore.set(null);
    };
  }, [container, shown]);
}
