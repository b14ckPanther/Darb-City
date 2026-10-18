"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { LocateHitDto } from "@darb/contracts";
import type { LatLng, Locale } from "@darb/core";
import { at, type AdminKey } from "./copy";
import { locatePlace, type LocateAnswer } from "./locate-actions";
import styles from "./PlaceFinder.module.css";

/** The language an address is written in, by its letters: which address field it belongs to. */
export function scriptOf(text: string): Locale {
  if (/[א-ת]/.test(text)) return "he";
  if (/[ء-ي]/.test(text)) return "ar";
  return "en";
}

export interface PlaceFinderProps {
  locale: Locale;
  /** The business's place (its address slug), read when Find is pressed. */
  placeSlug?: () => string | undefined;
  /** Moves the pin there, and flies the map to it. */
  onFound: (point: LatLng) => void;
  /** Whether the address field in this language is still empty (then filling it is offered). */
  canFillAddress?: (lang: Locale) => boolean;
  onFillAddress?: (lang: Locale, address: string) => void;
  /** A Google Maps link was pasted: keep it on the business. True when it was kept. */
  onGoogleLink?: (url: string) => boolean;
}

type Shown =
  | { state: "idle" }
  | { state: "finding" }
  | { state: "done"; answer: LocateAnswer; chosen: number; googleKept: boolean };

const MISS: Record<string, AdminKey> = {
  "not-found": "locateNotFound",
  off: "locateOff",
  busy: "locateBusy",
  error: "locateError",
  "signed-out": "locateError",
};

/**
 * Find the place: type an address ("שדרות המגינים 68, חיפה"; the town may be left out) or paste a
 * Google Maps or Waze link, and the pin goes there. A short line says how precise that is; when a
 * street has several parts, each is a button. No form of its own (it sits inside the business
 * form): Enter finds instead of saving.
 */
export function PlaceFinder({
  locale,
  placeSlug,
  onFound,
  canFillAddress,
  onFillAddress,
  onGoogleLink,
}: PlaceFinderProps) {
  const t = (key: AdminKey, vars?: Record<string, string | number>) => at(locale, key, vars);
  const id = useId();
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState<Shown>({ state: "idle" });
  const [filled, setFilled] = useState<string | null>(null);
  const asked = useRef(0);

  const find = async () => {
    const q = query.trim();
    if (!q || shown.state === "finding") return;
    const n = ++asked.current;
    setShown({ state: "finding" });
    setFilled(null);
    let answer: LocateAnswer;
    try {
      answer = await locatePlace({ query: q, locale, placeSlug: placeSlug?.() });
    } catch {
      answer = { found: null, reason: "error" };
    }
    if (n !== asked.current) return;
    if (answer.found) onFound(answer.found.point);
    const link = "googleLink" in answer ? answer.googleLink : null;
    const googleKept = link && onGoogleLink ? onGoogleLink(link) : false;
    setShown({ state: "done", answer, chosen: 0, googleKept });
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    // Inside the business form: Enter finds, it never saves.
    e.preventDefault();
    void find();
  };

  const answer = shown.state === "done" ? shown.answer : null;
  const hits: LocateHitDto[] =
    answer?.found && "alternatives" in answer ? [answer.found, ...answer.alternatives] : [];
  const chosen = shown.state === "done" ? (hits[shown.chosen] ?? null) : null;
  const precision = (h: LocateHitDto) =>
    h.precision === "exact"
      ? t("locateExact")
      : h.precision === "link"
        ? t("locateLink")
        : h.precision === "between" && h.between
          ? t("locateBetween", { lo: h.between[0], hi: h.between[1] })
          : t("locateStreet");
  const address = answer && "address" in answer ? answer.address : null;
  const lang = address ? scriptOf(address) : null;
  const offerFill = address && lang && onFillAddress && canFillAddress?.(lang) && filled === null;

  return (
    <div className={styles.finder} data-place-finder="">
      <label htmlFor={id} className={styles.label}>
        {t("locateLabel")}
      </label>
      <div className={styles.row}>
        <input
          id={id}
          type="text"
          dir="auto"
          inputMode="text"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          aria-describedby={`${id}-hint`}
        />
        <button
          type="button"
          className={styles.find}
          onClick={() => void find()}
          disabled={shown.state === "finding" || !query.trim()}
        >
          {shown.state === "finding" ? t("locateFinding") : t("locateFind")}
        </button>
      </div>
      <p id={`${id}-hint`} className={styles.hint}>
        {t("locateHint")}
      </p>
      <div role="status" aria-live="polite" className={styles.result}>
        {chosen ? (
          <p className={styles.line} data-precision={chosen.precision}>
            <bdi className={styles.found}>{chosen.label}</bdi> {precision(chosen)}
          </p>
        ) : answer ? (
          <p className={styles.line} data-precision="none">
            {t(MISS[answer.reason ?? "not-found"] ?? "locateNotFound")}
          </p>
        ) : null}
        {shown.state === "done" && shown.googleKept ? (
          <p className={styles.line}>{t("locateGoogleKept")}</p>
        ) : null}
        {filled ? <p className={styles.line}>{t("locateFilled")}</p> : null}
      </div>
      {hits.length > 1 ? (
        <div className={styles.parts}>
          <p className={styles.hint} id={`${id}-parts`}>
            {t("locateParts")}
          </p>
          <ul className={styles.choices} aria-labelledby={`${id}-parts`}>
            {hits.map((h, i) => (
              <li key={`${h.point.lat},${h.point.lng}`}>
                <button
                  type="button"
                  className={styles.choice}
                  aria-pressed={shown.state === "done" && shown.chosen === i}
                  onClick={() => {
                    if (shown.state !== "done") return;
                    setShown({ ...shown, chosen: i });
                    onFound(h.point);
                  }}
                >
                  <bdi>{h.near ? t("locateNear", { label: h.label, n: h.near }) : h.label}</bdi>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {offerFill ? (
        <button
          type="button"
          className={styles.choice}
          onClick={() => {
            onFillAddress!(lang!, address!);
            setFilled(address);
          }}
        >
          <bdi>{t("locateFillAddress", { address: address! })}</bdi>
        </button>
      ) : null}
    </div>
  );
}
