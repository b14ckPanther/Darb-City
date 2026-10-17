"use client";

import { useEffect } from "react";

/**
 * Opened from a search result: the item the search matched (`?hl=<key>`, see search-view) is
 * marked and brought into view on the business's screen. The key is only compared with the
 * screen's own item keys (data-match-keys), never shown or sent anywhere. Kept tiny: it ships
 * with every business page.
 */
export function MatchHighlight() {
  useEffect(() => {
    const key = new URLSearchParams(location.search).get("hl");
    if (!key) return;
    for (const el of document.querySelectorAll<HTMLElement>("[data-template] [data-match-keys]"))
      if (el.dataset["matchKeys"]!.split(" ").includes(key)) {
        el.dataset["highlight"] = "";
        el.scrollIntoView({ block: "center" });
        return;
      }
  }, []);
  return null;
}
