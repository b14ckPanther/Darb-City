"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { LatLng, Locale } from "@darb/core";
import type { PickerMap } from "@/stage/picker-map";
import { formatCoord, place, placeTyped, type Placed } from "./location-picker";
import styles from "./LocationPicker.module.css";

export interface LocationPickerLabels {
  /** The map's accessible name. */
  map: string;
  /** The pin's accessible name. */
  pin: string;
  /** Under the map: how to place the pin. */
  hint: string;
  centre: string;
  locate: string;
  locating: string;
  noLocation: string;
  outside: string;
  editNumbers: string;
  lat: string;
  lng: string;
  /** Shown over the numbers when the map cannot load. */
  noMap: string;
  mapData: string;
  gestures: { windows: string; mac: string; mobile: string };
}

export interface LocationPickerProps {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  locale: Locale;
  /** Where the map opens while there is no pin yet (the chosen place, say). */
  near?: LatLng | null;
  labels: LocationPickerLabels;
  /** The form fields that carry the point. */
  names?: { lat: string; lng: string };
}

type Mode = "waiting" | "map" | "numbers";

/**
 * A map with one pin for where something is: drag the pin, click the map, or move the pin with the
 * arrow keys. The numbers stay one tap away, and stand in for the map when it cannot load. Two
 * hidden inputs carry the point, so the picker drops into any form.
 */
export function LocationPicker({
  value,
  onChange,
  locale,
  near = null,
  labels,
  names = { lat: "lat", lng: "lng" },
}: LocationPickerProps) {
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<PickerMap | null>(null);
  const [mode, setMode] = useState<Mode>("waiting");
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ lat: string; lng: string } | null>(null);
  const [locating, setLocating] = useState(false);
  // The map's callbacks are bound once; they read the latest props through this.
  const latest = useRef({ value, onChange, labels });
  useEffect(() => {
    latest.current = { value, onChange, labels };
  });

  /** Keeps a point inside Israel, or says why not and leaves the pin where it was. */
  const take = (placed: Placed, from: "map" | "numbers" | "device"): boolean => {
    const { value: now, onChange: change, labels: l } = latest.current;
    if (placed.ok) {
      setMessage(null);
      change(placed.point);
      if (from !== "numbers") setDraft(null);
      if (from !== "map") map.current?.centreOn(placed.point);
      return true;
    }
    if (placed.reason === "outside") setMessage(l.outside);
    if (from === "map") map.current?.setPin(now);
    return false;
  };
  const takeRef = useRef(take);
  useEffect(() => {
    takeRef.current = take;
  });

  // The map loads when the picker comes into view, never before.
  useEffect(() => {
    const el = host.current;
    if (!el || mode !== "waiting") return;
    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    const start = async () => {
      observer?.disconnect();
      try {
        const { PickerMap } = await import("@/stage/picker-map");
        const { value: pin, labels: l } = latest.current;
        const created = await PickerMap.create({
          container: box.current!,
          locale,
          label: l.map,
          pinLabel: l.pin,
          pinDescribedBy: `${id}-at`,
          pinClass: styles.pin!,
          gestures: l.gestures,
          pin,
          near,
          onMove: (p) => takeRef.current(place(p), "map"),
        });
        if (cancelled) created.destroy();
        else {
          map.current = created;
          setMode("map");
        }
      } catch {
        // No WebGL, no tiles, a blocked module: the numbers do the job.
        if (!cancelled) setMode("numbers");
      }
    };
    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) void start();
        },
        { rootMargin: "200px" },
      );
      observer.observe(el);
    } else void start();
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
    // Starts once; later props reach the map through setPin and centreOn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => () => map.current?.destroy(), []);

  useEffect(() => {
    map.current?.setPin(value);
  }, [value, mode]);

  // A place chosen before the first pin: open over it.
  useEffect(() => {
    if (near && !latest.current.value) map.current?.centreOn(near, 13);
  }, [near?.lat, near?.lng, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = {
    lat: draft?.lat ?? (value ? formatCoord(value.lat) : ""),
    lng: draft?.lng ?? (value ? formatCoord(value.lng) : ""),
  };
  const type = (key: "lat" | "lng", text: string) => {
    const next = { ...shown, [key]: text };
    setDraft(next);
    take(placeTyped(next.lat, next.lng), "numbers");
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setMessage(labels.noLocation);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        take(place({ lat: coords.latitude, lng: coords.longitude }), "device");
      },
      () => {
        setLocating(false);
        setMessage(labels.noLocation);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const numbers = (
    <div className={styles.numbers}>
      {(["lat", "lng"] as const).map((key) => (
        <label key={key} className={styles.number}>
          <span>{labels[key]}</span>
          <input
            type="number"
            step="any"
            inputMode="decimal"
            dir="ltr"
            value={shown[key]}
            required={mode === "numbers"}
            onChange={(e) => type(key, e.target.value)}
            // Tidied to six decimals once kept; a half-typed or refused pair stays to be fixed.
            onBlur={() => {
              if (draft && placeTyped(draft.lat, draft.lng).ok) setDraft(null);
            }}
          />
        </label>
      ))}
    </div>
  );

  return (
    <div className={styles.picker} data-location-picker={mode}>
      <input type="hidden" name={names.lat} value={value ? String(value.lat) : ""} />
      <input type="hidden" name={names.lng} value={value ? String(value.lng) : ""} />
      {mode === "numbers" ? null : (
        <div ref={host} className={styles.frame}>
          {/* MapLibre makes its container position: relative, so it fills the frame. */}
          <div ref={box} className={styles.map} />
          <p className={styles.attribution}>
            {labels.mapData}:{" "}
            <bdi>
              <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">
                © OpenStreetMap
              </a>{" "}
              ·{" "}
              <a href="https://protomaps.com" rel="noreferrer">
                Protomaps
              </a>
            </bdi>
          </p>
        </div>
      )}
      {mode === "numbers" ? <p className={styles.note}>{labels.noMap}</p> : null}
      {mode === "map" ? <p className={styles.note}>{labels.hint}</p> : null}
      <div className={styles.tools}>
        {mode === "map" ? (
          <button
            type="button"
            className={styles.tool}
            disabled={!value}
            onClick={() => value && map.current?.centreOn(value)}
          >
            {labels.centre}
          </button>
        ) : null}
        <button type="button" className={styles.tool} disabled={locating} onClick={locate}>
          {locating ? labels.locating : labels.locate}
        </button>
        <output id={`${id}-at`} className={styles.at} dir="ltr" aria-live="polite">
          {value ? `${formatCoord(value.lat)}, ${formatCoord(value.lng)}` : ""}
        </output>
      </div>
      {message ? (
        <p role="status" className={styles.message}>
          {message}
        </p>
      ) : null}
      {mode === "numbers" ? (
        numbers
      ) : (
        <details className={styles.details}>
          <summary>{labels.editNumbers}</summary>
          {numbers}
        </details>
      )}
    </div>
  );
}
