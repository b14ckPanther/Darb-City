import type { Locale } from "@darb/core";
import { at, type AdminKey } from "./copy";
import type { ToolbarLabels } from "./ListToolbar";

/** Every list's toolbar words; only the search box's hint differs per list. */
export function toolbarLabels(locale: Locale, placeholder: AdminKey): ToolbarLabels {
  return {
    search: at(locale, "search"),
    placeholder: at(locale, placeholder),
    clear: at(locale, "clearSearch"),
    clearAll: at(locale, "clearFilters"),
    any: at(locale, "all"),
    narrow: at(locale, "narrowOptions"),
    noMatch: at(locale, "noMatches"),
    remove: at(locale, "removeFilter"),
  };
}
