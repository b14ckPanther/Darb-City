import { pickText, type Locale } from "@darb/core";
import type { IntentDto } from "@darb/contracts";
import { t } from "@darb/i18n";
import { deepSearch } from "@/content/deep-search";
import { getPlace, getPlaces, getTaxonomy } from "./api";
import { formatKm } from "./format";
import { placeNames } from "./rows";
import type { ViewContext } from "./search-view";
import { indexTaxonomy } from "./taxonomy";

/** Server only: what toSearchView needs, from cached API reads. */
export async function viewContext(locale: Locale, intent: IntentDto): Promise<ViewContext> {
  const [taxonomy, live, place] = await Promise.all([
    getTaxonomy(),
    getPlaces("live"),
    intent.place ? getPlace(intent.place) : null,
  ]);
  return {
    locale,
    index: indexTaxonomy(taxonomy),
    names: placeNames(place, live),
    place: place
      ? { slug: place.slug, name: pickText(place.name, locale), lat: place.lat, lng: place.lng }
      : null,
    placeSoon: place?.status === "soon",
    labels: {
      openNow: t(locale, "openNow"),
      delivers: t(locale, "delivers"),
      glutenFree: t(locale, "glutenFree"),
      nearMe: t(locale, "nearMe"),
      kindInPlace: t(locale, "kindInPlace"),
      kindNationwide: t(locale, "kindNationwide"),
      thingGlutenFree: deepSearch[locale].thingGlutenFree,
      searchWider: deepSearch[locale].searchWider,
      searchWiderNear: deepSearch[locale].searchWiderNear,
      searchRelated: deepSearch[locale].searchRelated,
    },
    kmLabel: (km) => formatKm(km, locale),
  };
}
