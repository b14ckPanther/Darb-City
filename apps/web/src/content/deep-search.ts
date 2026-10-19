import type { Locale } from "@darb/core";

/**
 * Deep search's own words: the matched thing on a result row and the honest line when results
 * come from further away. Kept here rather than in @darb/i18n, whose messages ship to every
 * page's browser code: these are read on the server and reach the browser only with search
 * results. Arabic is the everyday spoken kind; no dashes.
 */
export interface DeepSearchCopy {
  /** Said (unseen) before the matched thing: "Has shawarma". */
  matchedOn: string;
  /** The asked thing when the gluten-free kitchen is a must. */
  thingGlutenFree: string;
  searchWider: string;
  searchWiderNear: string;
  searchRelated: string;
  /** Before the closest kinds, when nothing (or nothing exact) answered: "Did you mean:". */
  didYouMean: string;
  /** Nothing at all answered and no chip to remove. */
  nothingFound: string;
  /** While the quick results are shown and the full search is still reading the words. */
  refining: string;
  /** Said (unseen) when the full search's results replace the quick ones. */
  refined: string;
}

export const deepSearch: Record<Locale, DeepSearchCopy> = {
  he: {
    matchedOn: "יש",
    thingGlutenFree: "{thing} ללא גלוטן",
    searchWider: "אין {thing} ב{place}. הכי קרוב: {name}, {where}, {distance}",
    searchWiderNear: "אין {thing} בסביבה. הכי קרוב: {name}, {where}, {distance}",
    searchRelated: "עוד לא מצאנו {thing}. אולי אלה יתאימו:",
    didYouMean: "אולי חיפשתם:",
    nothingFound: "לא מצאנו משהו שמתאים. נסו לכתוב את זה במילים אחרות.",
    refining: "מחדדים את התוצאות…",
    refined: "התוצאות עודכנו",
  },
  ar: {
    matchedOn: "فيه",
    thingGlutenFree: "{thing} بدون غلوتين",
    searchWider: "ما في {thing} ب{place}. الأقرب: {name}، {where}، {distance}",
    searchWiderNear: "ما في {thing} بالمنطقة. الأقرب: {name}، {where}، {distance}",
    searchRelated: "لسا ما لقينا {thing}. يمكن هدول يناسبوك:",
    didYouMean: "يمكن قصدك:",
    nothingFound: "ما لقينا اشي بناسب. جرّب تكتبها بكلمات تانية.",
    refining: "عم نزبّط النتايج…",
    refined: "النتايج اتحدّثت",
  },
  en: {
    matchedOn: "Has",
    thingGlutenFree: "gluten-free {thing}",
    searchWider: "No {thing} in {place}. Closest: {name}, {where}, {distance}",
    searchWiderNear: "No {thing} nearby. Closest: {name}, {where}, {distance}",
    searchRelated: "No {thing} found yet. These may suit you:",
    didYouMean: "Did you mean:",
    nothingFound: "Nothing matches that yet. Try other words.",
    refining: "Refining the results…",
    refined: "Results updated",
  },
};
