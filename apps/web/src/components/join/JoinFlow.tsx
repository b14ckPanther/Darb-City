"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { JoinSuggestionDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import type { JoinCopy } from "@/content/join";
import { emptyFields, fromSuggestion, lookupBody, type JoinFields } from "@/lib/join-form";
import type { PickerOption } from "./SearchPicker";
import styles from "./Join.module.css";

/** The card form loads after the first screen: the find step stays light on phones. */
const CheckStep = dynamic(() => import("./CheckStep").then((m) => m.CheckStep), {
  ssr: false,
  loading: () => <p className={styles.hint}>...</p>,
});

export interface PlaceOption extends PickerOption {
  lat: number;
  lng: number;
}

type Find =
  | { phase: "idle" }
  | { phase: "locating" }
  | { phase: "looking" }
  | { phase: "message"; key: "excluded" | "tooMany" | "failed" | "noLocation" | "empty" };

/**
 * /join: find the business (a name, a link, or where the owner stands), check the card that the
 * lookup filled in, send it for review. Focus moves to each step's heading as it opens.
 */
export function JoinFlow({
  locale,
  copy,
  kinds,
  places,
  uploads,
  homeHref,
}: {
  locale: Locale;
  copy: JoinCopy;
  kinds: PickerOption[];
  places: PlaceOption[];
  uploads: boolean;
  homeHref: string;
}) {
  const id = useId();
  const [step, setStep] = useState<"find" | "check" | "done">("find");
  const [text, setText] = useState("");
  const [find, setFind] = useState<Find>({ phase: "idle" });
  const [tick, setTick] = useState(0);
  const [start, setStart] = useState<{
    fields: JoinFields;
    suggestion: JoinSuggestionDto | null;
    notice: "none" | "off" | null;
  }>({ fields: emptyFields(), suggestion: null, notice: null });
  const heading = useRef<HTMLHeadingElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const busy = find.phase === "looking" || find.phase === "locating";

  // The progress lines take turns while the lookup runs (text only; no motion is needed).
  useEffect(() => {
    if (find.phase !== "looking") return;
    const timer = setInterval(() => setTick((t) => Math.min(t + 1, 2)), 2200);
    return () => clearInterval(timer);
  }, [find.phase]);

  useEffect(() => {
    if (step === "done") heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (find.phase === "message") alert.current?.focus();
  }, [find]);

  const manual = (name = "") => {
    const fields = emptyFields();
    fields.name[locale] = name;
    setStart({ fields, suggestion: null, notice: null });
    setStep("check");
  };

  async function lookup(body: object, typed: string) {
    setTick(0);
    setFind({ phase: "looking" });
    try {
      const res = await fetch("/api/join/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 429) return setFind({ phase: "message", key: "tooMany" });
      if (!res.ok) return setFind({ phase: "message", key: "failed" });
      const found = (await res.json()) as JoinSuggestionDto;
      if (found.reason === "excluded") return setFind({ phase: "message", key: "excluded" });
      if (!found.found) {
        const fields = emptyFields();
        // A typed name (not a link) is the business's name until the owner says otherwise.
        if ("query" in body) fields.name[locale] = typed.slice(0, 120);
        setStart({ fields, suggestion: null, notice: found.reason === "off" ? "off" : "none" });
      } else setStart({ fields: fromSuggestion(found), suggestion: found, notice: null });
      setFind({ phase: "idle" });
      setStep("check");
    } catch {
      setFind({ phase: "message", key: "failed" });
    }
  }

  const search = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!text.trim()) return setFind({ phase: "message", key: "empty" });
    void lookup(lookupBody(text, locale), text.trim());
  };

  const here = () => {
    if (busy) return;
    if (!("geolocation" in navigator)) return setFind({ phase: "message", key: "noLocation" });
    setFind({ phase: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        void lookup(
          {
            point: { lat: coords.latitude, lng: coords.longitude },
            ...(text.trim() ? { query: text.trim().slice(0, 200) } : {}),
            locale,
          },
          text.trim(),
        ),
      () => setFind({ phase: "message", key: "noLocation" }),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  if (step === "done")
    return (
      <section className={styles.done} aria-labelledby={`${id}-done`}>
        <span className={styles.doneMark} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path d="M5 12.5 9.5 17 19 7.5" />
          </svg>
        </span>
        <h2 id={`${id}-done`} ref={heading} tabIndex={-1} className={styles.stepTitle}>
          {copy.done.title}
        </h2>
        <p>{copy.done.body}</p>
        <Link href={homeHref} className={styles.secondary}>
          {copy.done.home}
        </Link>
      </section>
    );

  if (step === "check")
    return (
      <CheckStep
        locale={locale}
        copy={copy}
        kinds={kinds}
        places={places}
        uploads={uploads}
        initial={start.fields}
        suggestion={start.suggestion}
        notice={start.notice}
        headingRef={heading}
        onBack={() => setStep("find")}
        onSent={() => setStep("done")}
      />
    );

  const status =
    find.phase === "looking"
      ? copy.find.progress[tick]
      : find.phase === "locating"
        ? copy.find.locating
        : "";
  return (
    <section className={styles.find} aria-labelledby="main-heading" aria-busy={busy}>
      <form className={styles.findForm} onSubmit={search} noValidate>
        <label htmlFor={`${id}-q`} className={styles.findLabel}>
          {copy.find.label}
        </label>
        <p id={`${id}-q-hint`} className={styles.hint}>
          {copy.find.hint}
        </p>
        <div className={styles.findRow}>
          <input
            id={`${id}-q`}
            type="search"
            enterKeyHint="search"
            dir="auto"
            autoComplete="off"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            aria-describedby={`${id}-q-hint`}
          />
          <button type="submit" className={styles.primary} disabled={busy}>
            {copy.find.search}
          </button>
        </div>
      </form>
      <div className={styles.findMore}>
        <button type="button" className={styles.secondary} onClick={here} disabled={busy}>
          {copy.find.here}
        </button>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => manual(text.trim() && !/[/.]/.test(text) ? text.trim() : "")}
          disabled={busy}
        >
          {copy.find.manual}
        </button>
      </div>
      <p role="status" className={styles.progress} data-busy={busy || undefined}>
        {busy ? <span className={styles.progressBar} aria-hidden="true" /> : null}
        {status}
      </p>
      {find.phase === "message" ? (
        <p ref={alert} tabIndex={-1} role="alert" className={styles.alert}>
          {copy.find[find.key]}
        </p>
      ) : null}
    </section>
  );
}
