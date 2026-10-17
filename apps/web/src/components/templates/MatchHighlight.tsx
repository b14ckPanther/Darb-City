"use client";

import { useEffect, useRef } from "react";

/**
 * Opened from a search result: the item the search matched (`?hl=<key>`, see search-view) is
 * marked and brought into view on the business's screen. The key is only compared with the
 * screen's own item keys (data-match-keys), never shown or sent anywhere.
 */
export function MatchHighlight() {
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("hl");
    const screen = anchor.current?.parentElement;
    if (!key || !screen) return;
    const target = [...screen.querySelectorAll<HTMLElement>("[data-match-keys]")].find((el) =>
      (el.dataset["matchKeys"] ?? "").split(" ").includes(key),
    );
    if (!target) return;
    target.setAttribute("data-highlight", "");
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
    target.scrollIntoView?.({ block: "center", behavior: still ? "auto" : "smooth" });
  }, []);
  return <span ref={anchor} hidden />;
}
