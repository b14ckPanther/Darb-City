"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng, Locale } from "@darb/core";
import { LocationPicker, type LocationPickerLabels } from "@/components/LocationPicker";
import { placePoint } from "./business-actions";
import { PlaceFinder } from "./PlaceFinder";
import styles from "./admin.module.css";

/** A text field of the surrounding form, by name. */
const fieldOf = (form: HTMLFormElement | null | undefined, name: string) => {
  const el = form?.elements.namedItem(name);
  return el instanceof HTMLInputElement ? el : null;
};

/** Sets a form field as typing would, so the form's own listeners hear it. */
function setField(field: HTMLInputElement, value: string) {
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * The business's pin. A new business has no point yet: once its place is typed (the form's
 * "place" field), the map opens over that place. Find the place, above the map, puts the pin on
 * a typed address or a pasted map link; a pasted Google Maps link also fills links.google.
 */
export function BusinessLocation({
  locale,
  legend,
  value: initial,
  followPlace,
  placeSlug,
  labels,
}: {
  locale: Locale;
  legend: string;
  value: LatLng | null;
  followPlace: boolean;
  /** An existing business's place; a new one's is read from the form's "place" field. */
  placeSlug?: string;
  labels: LocationPickerLabels;
}) {
  const [value, setValue] = useState(initial);
  const [near, setNear] = useState<LatLng | null>(null);
  const [flyTo, setFlyTo] = useState<{ point: LatLng; key: number } | null>(null);
  const root = useRef<HTMLFieldSetElement>(null);
  const form = () => root.current?.form;

  useEffect(() => {
    const form = root.current?.form;
    if (!followPlace || !form) return;
    let asked = "";
    const onChange = (event: Event) => {
      const field = event.target as HTMLInputElement;
      if (field.name !== "place" || field.value === asked) return;
      asked = field.value;
      void placePoint(asked).then((p) => {
        if (p && asked === field.value) setNear(p);
      });
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, [followPlace]);

  return (
    <fieldset ref={root} style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
      <legend className={styles.hint}>{legend}</legend>
      <PlaceFinder
        locale={locale}
        placeSlug={() => placeSlug ?? fieldOf(form(), "place")?.value}
        onFound={(point) => {
          setValue(point);
          setFlyTo((f) => ({ point, key: (f?.key ?? 0) + 1 }));
        }}
        canFillAddress={(lang) => {
          const field = fieldOf(form(), `address.${lang}`);
          return Boolean(field && !field.value.trim());
        }}
        onFillAddress={(lang, address) => {
          const field = fieldOf(form(), `address.${lang}`);
          if (field) setField(field, address);
        }}
        onGoogleLink={(url) => {
          const field = fieldOf(form(), "links.google");
          if (!field) return false;
          if (field.value.trim() !== url) setField(field, url);
          return true;
        }}
      />
      <LocationPicker
        value={value}
        onChange={setValue}
        locale={locale}
        near={near}
        flyTo={flyTo}
        labels={labels}
      />
    </fieldset>
  );
}
