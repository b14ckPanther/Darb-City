import type { AdminKey } from "./copy";
import type { AdminIconName } from "./AdminIcon";

export interface NavItem {
  /** The admin path after the locale ("" is the overview). */
  href: string;
  label: AdminKey;
  icon: AdminIconName;
  /** Which count, if any, rides on the item. */
  badge?: "joins" | "inquiries" | "helpers";
  /** On the phone's bottom bar (the rest are under More). */
  tab?: boolean;
  /** A shorter name for the bottom bar. */
  short?: AdminKey;
}

export interface NavGroup {
  label: AdminKey;
  items: NavItem[];
}

/** The admin's map: four groups, in the order an admin's day runs. No route is renamed. */
export const NAV: NavGroup[] = [
  {
    label: "groupToday",
    items: [{ href: "", label: "navHome", icon: "overview", tab: true }],
  },
  {
    label: "groupContent",
    items: [
      { href: "/businesses", label: "navBusinesses", icon: "store", tab: true },
      { href: "/places", label: "navPlaces", icon: "pin" },
      { href: "/sectors", label: "navSectors", icon: "grid" },
      { href: "/kinds", label: "navKinds", icon: "tag" },
    ],
  },
  {
    label: "groupGrowth",
    items: [
      {
        href: "/join-requests",
        label: "navJoin",
        icon: "inbox",
        badge: "joins",
        tab: true,
        short: "tabJoin",
      },
      { href: "/field", label: "navStreet", icon: "camera", tab: true, short: "tabStreet" },
      { href: "/helpers", label: "navHelpers", icon: "people", badge: "helpers" },
      { href: "/inquiries", label: "navInquiries", icon: "mail", badge: "inquiries" },
      { href: "/report", label: "navReport", icon: "searchGap" },
    ],
  },
  {
    label: "groupSettings",
    items: [{ href: "/plans", label: "navPlans", icon: "settings" }],
  },
];

export const NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

/** The item a path belongs to: the longest matching prefix ("/businesses/x" → Businesses). */
export function activeItem(path: string): NavItem | undefined {
  const clean = path.split("?")[0] ?? "";
  return NAV_ITEMS.filter((i) =>
    i.href === ""
      ? clean === "" || clean === "/"
      : clean === i.href || clean.startsWith(`${i.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}

/** Remembers a folded sidebar, so the server draws the rail at once. */
export const RAIL_COOKIE = "darb_admin_rail";
