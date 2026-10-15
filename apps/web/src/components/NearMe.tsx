"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@darb/core";
import styles from "./NearMe.module.css";

export interface NearMeProps {
  locale: Locale;
  /** On a national kind page: find the nearest place that has it. */
  kind?: string;
  /** Where "pick a place" sends people when location is off. */
  homeHref: string;
  labels: { nearMe: string; locating: string; denied: string };
}

export function NearMe({ locale, kind, homeHref, labels }: NearMeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "locating" | "denied">("idle");

  function locate() {
    if (!("geolocation" in navigator)) {
      setState("denied");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const payload = {
          locale,
          lat: coords.latitude,
          lng: coords.longitude,
          ...(kind ? { kind } : {}),
        };
        try {
          // POST: the position stays out of URLs, so out of every access log.
          const res = await fetch("/api/near", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) throw new Error(String(res.status));
          const { href } = (await res.json()) as { href: string };
          // The button lives in the header and outlives the page, so it is reset once found.
          if (href !== pathname) router.push(href);
          setState("idle");
        } catch {
          setState("denied");
        }
      },
      () => setState("denied"),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }

  return (
    <div className={kind ? `${styles.nearMe} ${styles.inPage}` : styles.nearMe}>
      <button
        type="button"
        className={styles.button}
        onClick={locate}
        aria-busy={state === "locating"}
        {...(kind ? { "data-near-me-kind": "" } : { "data-near-me": "" })}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className={styles.label}>
          {state === "locating" ? labels.locating : labels.nearMe}
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
