"use server";

import {
  AdminBusinessCreateSchema,
  AdminBusinessPatchSchema,
  type AdminBusinessRowDto,
  type AdminKindDto,
  type AdminPlaceDto,
} from "@darb/contracts";
import type { Locale } from "@darb/core";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/locale";
import type { ActionState } from "./action-state";
import { adminApi } from "./api";
import { actionFailed, answered, apiError } from "./admin-errors";
import { businessFromForm, comparable } from "./business-form";
import { at } from "./copy";
import { changedOnly, text, zodErrors } from "./form-data";
import { adminHref } from "./routes";

const localeOf = (fd: FormData): Locale => {
  const l = text(fd, "locale");
  return isLocale(l) ? l : "he";
};
const fail = (locale: Locale, errors: string[], message?: string): ActionState => ({
  ok: false,
  message: message ?? at(locale, "errorGeneric"),
  errors,
});

export async function saveBusiness(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const id = text(fd, "id");
  const { data: read, kindSlugs, errors } = businessFromForm(fd);
  if (errors.length) return fail(locale, errors);
  // A showroom example's tier is fixed (the API refuses example_tier_fixed): its form has no tier.
  const { tier, ...rest } = read;
  const data = tier ? { ...rest, tier } : rest;
  const api = await adminApi();
  const kinds = await api.kinds.list({ query: {} });
  const bySlug = new Map(
    kinds.status === 200 ? kinds.body.map((k: AdminKindDto) => [k.slug, k.id]) : [],
  );
  const unknown = kindSlugs.filter((s) => !bySlug.has(s));
  if (unknown.length)
    return fail(
      locale,
      unknown.map((s) => `kinds: no kind “${s}”`),
    );
  const kindIds = [...new Set(kindSlugs.map((s) => bySlug.get(s)!))]
    .filter((k) => k !== data.primaryKindId)
    .sort();

  let res: { status: number; body: unknown };
  if (id) {
    const got = await api.businesses.get({ params: { id } });
    if (got.status === 401) redirect(adminHref(locale, "/sign-in"));
    if (got.status !== 200) notFound();
    // Only what changed: the audit names real fields, and an unchanged tier is never re-sent.
    const patch = changedOnly({ ...data, kindIds }, comparable(got.body));
    if (Object.keys(patch).length === 0)
      return { ok: true, message: at(locale, "saved"), errors: [] };
    const parsed = AdminBusinessPatchSchema.safeParse(patch);
    if (!parsed.success) return fail(locale, zodErrors(parsed.error));
    res = await api.businesses.update({ params: { id }, body: parsed.data });
  } else {
    const placeSlug = text(fd, "place");
    const found = await api.places.list({ query: { q: placeSlug, limit: 100 } });
    const place =
      found.status === 200
        ? found.body.items.find((p: AdminPlaceDto) => p.slug === placeSlug)
        : undefined;
    const parsed = AdminBusinessCreateSchema.safeParse({
      ...data,
      kindIds,
      slug: text(fd, "slug"),
      placeId: place?.id ?? "",
      status: "draft",
    });
    if (!parsed.success) return fail(locale, zodErrors(parsed.error));
    res = await api.businesses.create({ body: parsed.data });
  }
  if (res.status === 200 || res.status === 201) {
    revalidatePath("/admin/[locale]", "layout");
    if (!id) redirect(adminHref(locale, `/businesses/${(res.body as AdminBusinessRowDto).id}`));
    return { ok: true, message: at(locale, "saved"), errors: [] };
  }
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  return apiError(locale, res, id ? {} : { conflict: "errAlreadyExists" });
}

export async function setBusinessStatus(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const status = text(fd, "status");
  if (status !== "published" && status !== "suspended" && status !== "draft")
    return actionFailed(locale, "errStatusNotChanged");
  // Suspending is the takedown: an API that is down or answers 5xx must show, never pass silently.
  const res = await answered(async () =>
    (await adminApi()).businesses.status({
      params: { id: text(fd, "id") },
      body: { status },
    }),
  );
  if (!res) return actionFailed(locale, "errStatusNotChanged");
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  if (res.status !== 200) return actionFailed(locale, "errStatusNotChanged", res);
  revalidatePath("/admin/[locale]", "layout");
  return { ok: true, message: null, errors: [] };
}

export async function deleteBusiness(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const res = await answered(async () =>
    (await adminApi()).businesses.remove({
      params: { id: text(fd, "id") },
      body: {},
    }),
  );
  if (!res) return actionFailed(locale, "errNotDeleted");
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  if (res.status !== 200) return actionFailed(locale, "errNotDeleted", res);
  revalidatePath("/admin/[locale]", "layout");
  redirect(adminHref(locale, "/businesses"));
}
