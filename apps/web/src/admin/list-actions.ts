"use server";

import { AdminBulkSchema, type AdminPlaceDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/locale";
import { adminApi } from "./api";
import { at } from "./copy";
import type { FilterOption } from "./ListToolbar";

export interface BulkOutcome {
  ok: boolean;
  message: string;
}

/** Many businesses at once: publish, back to draft, suspend, or another kind. Each one audited. */
export async function bulkBusinesses(
  rawLocale: string,
  ids: string[],
  action: string,
  kindId?: string,
): Promise<BulkOutcome> {
  const locale = isLocale(rawLocale) ? rawLocale : "he";
  const parsed = AdminBulkSchema.safeParse({
    ids,
    action,
    ...(action === "kind" ? { kindId } : {}),
  });
  if (!parsed.success) return { ok: false, message: at(locale, "bulkFailed") };
  try {
    const res = await (await adminApi()).businesses.bulk({ body: parsed.data });
    if (res.status !== 200) return { ok: false, message: at(locale, "bulkFailed") };
    revalidatePath("/admin/[locale]", "layout");
    const { changed, unchanged, failed, revalidated } = res.body;
    const parts = [
      at(locale, "bulkChanged", { count: changed }),
      unchanged ? at(locale, "bulkUnchanged", { count: unchanged }) : "",
      failed.length ? at(locale, "bulkNotChanged", { count: failed.length }) : "",
      revalidated === false ? at(locale, "bulkStale") : "",
    ].filter(Boolean);
    return { ok: failed.length === 0 && revalidated !== false, message: parts.join(" ") };
  } catch {
    return { ok: false, message: at(locale, "bulkFailed") };
  }
}

/** The place filter's options as the admin types: a few places by name. */
export async function placeOptions(rawLocale: string, q: string): Promise<FilterOption[]> {
  const locale = isLocale(rawLocale) ? rawLocale : "he";
  const query = q.trim().slice(0, 80);
  if (query.length < 2) return [];
  try {
    const res = await (
      await adminApi()
    ).places.list({
      query: { q: query, limit: 10, sort: "businesses", locale },
    });
    if (res.status !== 200) return [];
    return res.body.items.map((p: AdminPlaceDto) => ({
      value: p.slug,
      label: pickText(p.name, locale),
      note: p.businessCount ? String(p.businessCount) : undefined,
    }));
  } catch {
    return [];
  }
}
