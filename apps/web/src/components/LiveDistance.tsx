"use client";

import { useSyncExternalStore } from "react";
import { kmBetween, serverSnapshot, snapshot, subscribe } from "@/lib/live-position";
import styles from "./List.module.css";

/**
 * How far a business is from the visitor, live as they move. Shows only once the browser already
 * shares the location with Darb (never prompts), so the server render and first paint have none.
 */
export function LiveDistance({
  lat,
  lng,
  template,
  metres,
  locale,
}: {
  lat: number;
  lng: number;
  /** "{km} km" in the page language. */
  template: string;
  /** "{m} m" in the page language. */
  metres: string;
  locale: string;
}) {
  const here = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (!here) return null;
  const km = kmBetween(here, { lat, lng });
  const value =
    km < 1
      ? metres.replace("{m}", String(Math.max(50, Math.round((km * 1000) / 50) * 50)))
      : template.replace(
          "{km}",
          new Intl.NumberFormat(locale, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km),
        );
  return (
    <span className={`${styles.rowPlace} ${styles.live}`} data-live-distance="">
      <span className={styles.liveDot} aria-hidden="true" />
      <bdi>{value}</bdi>
    </span>
  );
}
