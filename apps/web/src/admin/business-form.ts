import type { AdminBusinessPatchDto } from "@darb/contracts";
import { lines, localized, text } from "./form-data";
import { parseExceptions } from "./hours-form";

export type BusinessFormData = Omit<AdminBusinessPatchDto, "kindIds">;

/** A minimal screen that passes the shared content schema: the starting point for a new business. */
export const EMPTY_EXPERIENCE: Record<string, unknown> = {
  brand: { en: "Business name" },
  title: { en: "Welcome" },
  items: [{ label: { en: "First item" } }],
  cta: { en: "Contact us" },
  palette: { bg: "#08241a", surface: "#0e3527", ink: "#fbf7ec", accent: "#d9a54c" },
  font: "Heebo",
};

const json = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};
const orNull = (v: string) => (v === "" ? null : v);

type WeeklyHours = NonNullable<BusinessFormData["hours"]>["weekly"];
/** Closed days are simply absent, as the seed writes them. */
const compactWeekly = (weekly: unknown): WeeklyHours =>
  Object.fromEntries(
    Object.entries(
      (weekly && typeof weekly === "object" ? weekly : {}) as Record<string, unknown[]>,
    ).filter(([, v]) => Array.isArray(v) && v.length > 0),
  ) as WeeklyHours;

/**
 * A saved business in the shape the form produces, so an unchanged field diffs as unchanged:
 * extra kinds without the primary, sorted; delivers always present; dietary sorted; closed days
 * absent; byAppointment and addressHidden only when true.
 */
export function comparable<
  T extends {
    primaryKindId: string;
    kindIds: string[];
    attributes: Record<string, unknown>;
    dietary: readonly string[];
    hours: { weekly: unknown; exceptions: unknown; byAppointment?: boolean };
  },
>(b: T): T {
  const { addressHidden, ...attributes } = b.attributes;
  const { byAppointment, ...hours } = b.hours;
  return {
    ...b,
    kindIds: b.kindIds.filter((k) => k !== b.primaryKindId).sort(),
    attributes: {
      ...attributes,
      delivers: b.attributes.delivers === true,
      ...(addressHidden === true ? { addressHidden: true } : {}),
    },
    dietary: [...b.dietary].sort(),
    hours: {
      ...hours,
      weekly: compactWeekly(b.hours.weekly),
      ...(byAppointment === true ? { byAppointment: true } : {}),
    },
  };
}

export function businessFromForm(fd: FormData): {
  data: BusinessFormData;
  kindSlugs: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const experience = json(text(fd, "experience"));
  if (experience === undefined || typeof experience !== "object" || experience === null)
    errors.push("experience: not valid JSON");
  // The map picker leaves both empty until the pin is placed: say so, not "lat: too small".
  if (text(fd, "lat") === "" || text(fd, "lng") === "")
    errors.push("location: put the pin on the map");
  const weekly = json(text(fd, "hours.weekly") || "{}");
  const ex = parseExceptions(text(fd, "hours.exceptions"));
  if (!ex.ok) errors.push(`hours: cannot read “${ex.line}”`);
  const base = (json(text(fd, "attributes.base") || "{}") ?? {}) as Record<
    string,
    boolean | string | number
  >;
  const apps = Object.fromEntries(
    (["web", "ios", "android"] as const).flatMap((k) => {
      const v = text(fd, `apps.${k}`);
      return v ? [[k, v]] : [];
    }),
  );
  return {
    errors,
    kindSlugs: lines(fd, "kinds"),
    data: {
      name: localized(fd, "name"),
      tagline: localized(fd, "tagline"),
      address: localized(fd, "address"),
      primaryKindId: text(fd, "primaryKindId"),
      lat: Number(text(fd, "lat")),
      lng: Number(text(fd, "lng")),
      phone: orNull(text(fd, "phone")),
      whatsapp: orNull(text(fd, "whatsapp")),
      website: orNull(text(fd, "website")),
      hours: {
        weekly: compactWeekly(weekly),
        exceptions: ex.ok ? ex.value : [],
        ...(fd.get("byAppointment") === "on" ? { byAppointment: true } : {}),
      },
      attributes: {
        ...base,
        delivers: fd.get("delivers") === "on",
        ...(fd.get("addressHidden") === "on" ? { addressHidden: true } : {}),
      },
      dietary: fd.get("glutenFree") === "on" ? ["gluten_free"] : [],
      experience: (experience ?? {}) as Record<string, unknown>,
      tier: text(fd, "tier") as BusinessFormData["tier"],
      apps,
    },
  };
}
