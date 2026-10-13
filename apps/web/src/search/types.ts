export type OptionGroup = "places" | "kinds" | "businesses" | "search";

/** One row of the combobox listbox, already localized. */
export interface SearchOption {
  id: string;
  group: OptionGroup;
  label: string;
  sublabel?: string;
  href: string;
}

/** Strings the client components receive (they never import @darb/i18n). */
export interface SearchLabels {
  search: string;
  placeholder: string;
  places: string;
  kinds: string;
  businesses: string;
  searchFor: string; // with {q}
  suggestionCount: string; // with {count}
  noSuggestions: string;
  /** The sublabel of a kind on its own: its page lists it across the country. */
  nationwide: string;
}
