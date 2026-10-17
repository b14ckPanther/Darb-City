"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@darb/core";
import { positionGranted } from "@/lib/live-position";
import styles from "./NearMe.module.css";

export interface NearMeProps {
  locale: Locale;
  /** On a national kind page: find the nearest place that has it. */
  kind?: string;
  /** Where "pick a place" sends people when location is off. */
  homeHref: string;
  /** The header button: the /near page in this locale (from the server, so no route code ships). */
  nearHref?: string;
  labels: { nearMe: string; locating: string; denied: string };
}

/** The last place found, kept on this device for a while so the header keeps saying where you are. */
const KEPT_FOR = 12 * 60 * 60 * 1000;
const storeKey = (locale: Locale) => `darb.near.${locale}`;

function recall(locale: Locale): { name: string; href: string } | null {
  try {
    const kept = JSON.parse(localStorage.getItem(storeKey(locale)) ?? "null") as {
      name?: unknown;
      href?: unknown;
      at?: unknown;
    } | null;
    if (!kept || typeof kept.name !== "string" || typeof kept.href !== "string") return null;
    if (typeof kept.at !== "number" || Date.now() - kept.at > KEPT_FOR) return null;
    return { name: kept.name, href: kept.href };
  } catch {
    return null;
  }
}

function keep(locale: Locale, found: { name: string; href: string }) {
  try {
    localStorage.setItem(storeKey(locale), JSON.stringify({ ...found, at: Date.now() }));
  } catch {
    // Private mode or storage off: the name still shows until the page reloads.
  }
}

/** POST: the position stays out of URLs, so out of every access log. */
async function nearestPlace(payload: {
  locale: Locale;
  lat: number;
  lng: number;
  kind?: string;
}): Promise<{ href: string; name?: string }> {
  const res = await fetch("/api/near", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as { href: string; name?: string };
}

export function NearMe({ locale, kind, homeHref, nearHref, labels }: NearMeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "locating" | "denied">("idle");
  // The header button names the place it found (the in-page kind button keeps its own label).
  const [found, setFound] = useState<string | null>(null);
  useEffect(() => {
    if (kind) return;
    const kept = recall(locale);
    // Read after mount: the server render has no storage, so the first paint says "near me".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (kept) setFound(kept.name);
  }, [kind, locale]);

  /** The header button: a precise fix, kept in this tab only, then the businesses around it. */
  async function goNear(position: GeolocationPosition) {
    // Loaded on the tap: every page carries this button, few press it.
    const { hereFrom, keepHere } = await import("@/lib/here");
    const here = hereFrom(position);
    positionGranted({ lat: here.lat, lng: here.lng });
    keepHere(here);
    if (nearHref && nearHref !== pathname) router.push(nearHref);
    setState("idle");
    // The label only: the place the visitor is in. The page lists businesses on its own.
    void nearestPlace({ locale, lat: here.lat, lng: here.lng })
      .then(({ href: placeHref, name }) => {
        if (!name) return;
        setFound(name);
        keep(locale, { name, href: placeHref });
      })
      .catch(() => {});
  }

  /** The in-page button on a national kind page: the nearest place that has the kind. */
  async function goToKind(position: GeolocationPosition, slug: string) {
    const { latitude: lat, longitude: lng } = position.coords;
    // Granted: rows across the site may now show how far each business is.
    positionGranted({ lat, lng });
    try {
      const { href: placeHref } = await nearestPlace({ locale, lat, lng, kind: slug });
      // The button outlives the page, so it is reset once found.
      if (placeHref !== pathname) router.push(placeHref);
      setState("idle");
    } catch {
      setState("denied");
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setState("denied");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => void (kind ? goToKind(position, kind) : goNear(position)),
      () => setState("denied"),
      // The header button wants where the visitor stands now, not a cached town-level guess.
      kind
        ? { timeout: 10_000, maximumAge: 600_000 }
        : { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 },
    );
  }

  return (
    <div className={kind ? `${styles.nearMe} ${styles.inPage}` : styles.nearMe}>
      <button
        type="button"
        className={styles.button}
        onClick={locate}
        aria-busy={state === "locating"}
        aria-label={found && state !== "locating" ? `${labels.nearMe}: ${found}` : undefined}
        {...(kind ? { "data-near-me-kind": "" } : { "data-near-me": "" })}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className={styles.label}>
          {state === "locating" ? labels.locating : (found ?? labels.nearMe)}
        </span>
      </button>
      {state === "denied" ? (
        <p role="status" className={styles.message} data-near-me-message="">
          <Link href={`${homeHref}#places`}>{labels.denied}</Link>
        </p>
      ) : null}
    </div>
  );
}
