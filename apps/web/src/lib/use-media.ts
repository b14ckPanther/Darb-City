import { useSyncExternalStore } from "react";

export const DESKTOP = "(min-width: 900px)";
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const supported = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/** A media query as state. False on the server (and in tests without matchMedia). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!supported()) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => supported() && window.matchMedia(query).matches,
    () => false,
  );
}
