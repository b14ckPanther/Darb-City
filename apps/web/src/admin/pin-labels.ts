import type { Locale } from "@darb/core";
import type { LocationPickerLabels } from "@/components/LocationPicker";
import { at } from "./copy";

/** The map picker's words, the same on every editor. */
export function pinLabels(locale: Locale): LocationPickerLabels {
  const t = (k: Parameters<typeof at>[1]) => at(locale, k);
  return {
    map: t("pinMap"),
    pin: t("pinPin"),
    hint: t("pinHint"),
    centre: t("pinCentre"),
    locate: t("pinLocate"),
    locating: t("pinLocating"),
    noLocation: t("pinNoLocation"),
    outside: t("pinOutside"),
    editNumbers: t("pinEditNumbers"),
    lat: t("fieldLat"),
    lng: t("fieldLng"),
    noMap: t("pinNoMap"),
    mapData: t("pinMapData"),
    gestures: {
      windows: t("pinGestureWindows"),
      mac: t("pinGestureMac"),
      mobile: t("pinGestureMobile"),
    },
  };
}
