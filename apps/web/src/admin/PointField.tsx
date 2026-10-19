"use client";

import { useState } from "react";
import type { LatLng, Locale } from "@darb/core";
import { LocationPicker, type LocationPickerLabels } from "@/components/LocationPicker";

/** A point on the map (a place's centre): drag the pin or tap; hidden lat and lng go with the form. */
export function PointField({
  locale,
  value: initial,
  labels,
}: {
  locale: Locale;
  value: LatLng | null;
  labels: LocationPickerLabels;
}) {
  const [value, setValue] = useState(initial);
  return <LocationPicker value={value} onChange={setValue} locale={locale} labels={labels} />;
}
