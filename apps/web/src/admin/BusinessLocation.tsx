"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng, Locale } from "@darb/core";
import { LocationPicker, type LocationPickerLabels } from "@/components/LocationPicker";
import { placePoint } from "./business-actions";
import styles from "./admin.module.css";

/**
 * The business's pin. A new business has no point yet: once its place is typed (the form's
 * "place" field), the map opens over that place.
 */
export function BusinessLocation({
  locale,
  legend,
  value: initial,
  followPlace,
  labels,
}: {
  locale: Locale;
  legend: string;
  value: LatLng | null;
  followPlace: boolean;
  labels: LocationPickerLabels;
}) {
  const [value, setValue] = useState(initial);
  const [near, setNear] = useState<LatLng | null>(null);
  const root = useRef<HTMLFieldSetElement>(null);

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
      <LocationPicker
        value={value}
        onChange={setValue}
        locale={locale}
        near={near}
        labels={labels}
      />
    </fieldset>
  );
}
