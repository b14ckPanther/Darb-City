"use server";

import {
  AdminKindCreateSchema,
  AdminKindPatchSchema,
  AdminPlaceCreateSchema,
  AdminPlacePatchSchema,
  AdminSectorCreateSchema,
  AdminSectorPatchSchema,
  ADMIN_ENTITIES,
  type AdminEntity,
  type AdminKindDto,
  type AdminPlaceDto,
  type AdminSectorDto,
} from "@darb/contracts";
import type { Locale } from "@darb/core";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/locale";
import type { ActionState } from "./action-state";
import { apiError } from "./admin-errors";
import { adminApi } from "./api";
import { at } from "./copy";
import { changedOnly, kindFields, placeFields, sectorFields, text, zodErrors } from "./form-data";
import { adminHref } from "./routes";

const localeOf = (fd: FormData): Locale => {
  const l = text(fd, "locale");
  return isLocale(l) ? l : "he";
};

/** Runs an API write and turns its answer into form state, or navigates on success. */
async function send(
  locale: Locale,
  res: { status: number; body: unknown },
  /** A create names where its new row lives; an update stays on its page. */
  created: ((body: { id?: string }) => string) | null,
): Promise<ActionState> {
  if (res.status === 200 || res.status === 201) {
    revalidatePath("/admin/[locale]", "layout");
    if (created) redirect(created(res.body as { id?: string }));
    return saved(locale);
  }
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  // A 409 on a create is a taken web address; the API's codes say the rest.
  return apiError(locale, res, created ? { conflict: "errAlreadyExists" } : {});
}
const saved = (locale: Locale): ActionState => ({
  ok: true,
  message: at(locale, "saved"),
  errors: [],
});
const invalid = (locale: Locale, errors: string[]): ActionState => ({
  ok: false,
  message: at(locale, "errorGeneric"),
  errors,
});
/** The saved row, for diffing; a vanished row or a lost session ends here like a page would. */
const current = <T>(locale: Locale, res: { status: number; body: unknown }): T => {
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  if (res.status !== 200) notFound();
  return res.body as T;
};

export async function savePlace(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const id = text(fd, "id");
  const api = await adminApi();
  if (id) {
    const before = current<AdminPlaceDto>(locale, await api.places.get({ params: { id } }));
    const patch = changedOnly(placeFields(fd), before);
    if (Object.keys(patch).length === 0) return saved(locale);
    const parsed = AdminPlacePatchSchema.safeParse(patch);
    if (!parsed.success) return invalid(locale, zodErrors(parsed.error));
    return send(locale, await api.places.update({ params: { id }, body: parsed.data }), null);
  }
  // A new place names its parent by address; resolve it to an id.
  const parentSlug = text(fd, "parent");
  const found = await api.places.list({ query: { q: parentSlug, limit: 100 } });
  const parent =
    found.status === 200
      ? found.body.items.find((p: AdminPlaceDto) => p.slug === parentSlug)
      : undefined;
  const parsed = AdminPlaceCreateSchema.safeParse({
    ...placeFields(fd),
    slug: text(fd, "slug"),
    type: text(fd, "type"),
    parentId: parent?.id ?? "",
  });
  if (!parsed.success) return invalid(locale, zodErrors(parsed.error));
  return send(locale, await api.places.create({ body: parsed.data }), (b) =>
    adminHref(locale, `/places/${b.id}`),
  );
}

export async function saveSector(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const id = text(fd, "id");
  const api = await adminApi();
  if (id) {
    // There is no single-sector GET: the list is short.
    const all = current<AdminSectorDto[]>(locale, await api.sectors.list());
    const before = all.find((s) => s.id === id);
    if (!before) notFound();
    const patch = changedOnly(sectorFields(fd), before);
    if (Object.keys(patch).length === 0) return saved(locale);
    const parsed = AdminSectorPatchSchema.safeParse(patch);
    if (!parsed.success) return invalid(locale, zodErrors(parsed.error));
    return send(locale, await api.sectors.update({ params: { id }, body: parsed.data }), null);
  }
  const parsed = AdminSectorCreateSchema.safeParse({ ...sectorFields(fd), slug: text(fd, "slug") });
  if (!parsed.success) return invalid(locale, zodErrors(parsed.error));
  return send(locale, await api.sectors.create({ body: parsed.data }), () =>
    adminHref(locale, "/sectors"),
  );
}

export async function saveKind(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const id = text(fd, "id");
  const api = await adminApi();
  const { status, ...fields } = kindFields(fd);
  if (id) {
    const before = current<AdminKindDto>(locale, await api.kinds.get({ params: { id } }));
    const patch = changedOnly({ ...fields, status }, before);
    if (Object.keys(patch).length === 0) return saved(locale);
    const parsed = AdminKindPatchSchema.safeParse(patch);
    if (!parsed.success) return invalid(locale, zodErrors(parsed.error));
    return send(locale, await api.kinds.update({ params: { id }, body: parsed.data }), null);
  }
  // New kinds always start hidden; the create body never names a status (the API refuses one).
  const parsed = AdminKindCreateSchema.safeParse({ ...fields, slug: text(fd, "slug") });
  if (!parsed.success) return invalid(locale, zodErrors(parsed.error));
  return send(locale, await api.kinds.create({ body: parsed.data }), (b) =>
    adminHref(locale, `/kinds/${b.id}`),
  );
}

export async function releaseEntity(fd: FormData): Promise<void> {
  const entity = text(fd, "entity") as AdminEntity;
  if (!(ADMIN_ENTITIES as readonly string[]).includes(entity)) return;
  await (await adminApi()).misc.release({ params: { entity, id: text(fd, "id") }, body: {} });
  revalidatePath("/admin/[locale]", "layout");
}
