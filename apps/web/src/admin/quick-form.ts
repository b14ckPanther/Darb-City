import type { AdminBusinessDto, AdminBusinessPatchDto } from "@darb/contracts";
import { emailHref, LINK_KEYS, phoneHref, type Localized } from "@darb/core";

/** The fields the quick editor on the public card can change. */
export const QUICK_LINKS = ["instagram", "facebook", "tiktok", "google"] as const;

/** What the quick editor sends: only its own fields, as typed. */
export interface QuickInput {
  name: Localized;
  tagline: Localized;
  address: Localized;
  primaryKindId: string;
  phone: string;
  whatsapp: string;
  website: string;
  links: Partial<Record<(typeof LINK_KEYS)[number], string>>;
  weekly: Record<string, { open: string; close: string }[]>;
  lat: number | null;
  lng: number | null;
}

const clean = (l: Localized): Localized =>
  Object.fromEntries(
    (["he", "ar", "en"] as const).flatMap((k) => (l[k]?.trim() ? [[k, l[k]!.trim()]] : [])),
  );
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

/**
 * The PATCH body for what the quick editor changed, and nothing else: an untouched field is never
 * sent (the audit names real changes), links merge into the business's other links, and hours
 * keep their special days and appointment flag.
 */
export function quickPatch(input: QuickInput, b: AdminBusinessDto): AdminBusinessPatchDto {
  const patch: AdminBusinessPatchDto = {};
  for (const key of ["name", "tagline", "address"] as const) {
    const next = clean(input[key]);
    if (!same(sorted(next), sorted(clean(b[key])))) patch[key] = next;
  }
  if (input.primaryKindId && input.primaryKindId !== b.primaryKindId)
    patch.primaryKindId = input.primaryKindId;
  for (const key of ["phone", "whatsapp", "website"] as const) {
    const next = input[key].trim() || null;
    if (next !== (b[key] ?? null)) patch[key] = next;
  }
  const links: Record<string, string> = { ...(b.links as Record<string, string>) };
  for (const [k, raw] of Object.entries(input.links)) {
    const v = (raw ?? "").trim();
    const stored = k === "email" ? (emailHref(v) ?? v) : k === "phone2" ? (phoneHref(v) ?? v) : v;
    if (stored) links[k] = stored;
    else delete links[k];
  }
  if (!same(sorted(links), sorted(b.links as Record<string, unknown>)))
    patch.links = links as AdminBusinessPatchDto["links"];
  const weekly = Object.fromEntries(
    Object.entries(input.weekly).filter(([, v]) => Array.isArray(v) && v.length > 0),
  );
  if (!same(sorted(weekly), sorted(b.hours.weekly as Record<string, unknown>)))
    patch.hours = { ...b.hours, weekly } as AdminBusinessPatchDto["hours"];
  if (input.lat !== null && input.lng !== null && (input.lat !== b.lat || input.lng !== b.lng)) {
    patch.lat = input.lat;
    patch.lng = input.lng;
  }
  return patch;
}
