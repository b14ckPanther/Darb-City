"use server";

import {
  HelperApplySchema,
  HelperPatchSchema,
  LocateQuerySchema,
  type LocateResultDto,
} from "@darb/contracts";
import { isSlug, type Locale } from "@darb/core";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_HINT_COOKIE } from "@/admin/marker";
import { adminAuthMode, FAKE_COOKIE } from "@/admin/mode";
import { isLocale } from "@/lib/locale";
import { helperApi } from "./api";
import { ht, type HelperKey } from "./copy";
import type { FormState } from "./form-state";
import { helperHref } from "./routes";

const localeOf = (fd: FormData): Locale => {
  const l = String(fd.get("locale") ?? "");
  return isLocale(l) ? l : "he";
};
const field = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();
const fail = (locale: Locale, errors: Record<string, HelperKey>): FormState => ({
  ok: false,
  errors: Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, ht(locale, v)])),
});

/** The one-screen form: name, phone, home town and an optional note. Waiting comes next. */
export async function applyHelper(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = localeOf(fd);
  const parsed = HelperApplySchema.safeParse({
    name: field(fd, "name"),
    phone: field(fd, "phone"),
    placeId: field(fd, "placeId"),
    ...(field(fd, "note") ? { note: field(fd, "note").slice(0, 500) } : {}),
  });
  if (!parsed.success) {
    const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
    return fail(locale, {
      ...(bad.has("name") ? { name: "applyNameNeeded" } : {}),
      ...(bad.has("phone") ? { phone: "applyPhoneNeeded" } : {}),
      ...(bad.has("placeId") ? { placeId: "applyTownNeeded" } : {}),
      ...(bad.has("note") ? { form: "applyFailed" } : {}),
    } as Record<string, HelperKey>);
  }
  const res = await (await helperApi()).apply({ body: parsed.data }).catch(() => null);
  if (res?.status === 401) redirect(helperHref(locale, "/sign-in"));
  if (res?.status === 404) return fail(locale, { placeId: "applyTownNeeded" });
  if (res?.status !== 200) return fail(locale, { form: "applyFailed" });
  revalidatePath("/helpers/[locale]", "layout");
  redirect(helperHref(locale));
}

/** The display name, or the public credit toggle (the API refreshes the cards that show it). */
export async function updateHelper(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = localeOf(fd);
  // The toggle's form sends a hidden "false" and, when ticked, the box's "on" after it.
  const credit = fd.getAll("credit").map(String);
  const parsed = HelperPatchSchema.safeParse({
    ...(fd.has("name") ? { name: field(fd, "name") } : {}),
    ...(credit.length ? { credit: credit.includes("on") } : {}),
  });
  if (!parsed.success) return fail(locale, { name: "applyNameNeeded" });
  const res = await (await helperApi()).update({ body: parsed.data }).catch(() => null);
  if (res?.status === 401) redirect(helperHref(locale, "/sign-in"));
  if (res?.status !== 200) return fail(locale, { form: "profileFailed" });
  revalidatePath("/helpers/[locale]", "layout");
  return { ok: true, errors: {} };
}

/** The place finder for the helper's capture: POST /helpers/field/locate with their own token. */
export async function locateForHelper(input: {
  query: string;
  locale: string;
  placeSlug?: string;
}): Promise<LocateResultDto | { found: null; reason: "error" | "signed-out" }> {
  const parsed = LocateQuerySchema.safeParse({
    query: input.query,
    locale: input.locale,
    ...(input.placeSlug && isSlug(input.placeSlug.trim())
      ? { placeSlug: input.placeSlug.trim() }
      : {}),
  });
  if (!parsed.success) return { found: null, reason: "error" };
  try {
    const res = await (await helperApi()).field.locate({ body: parsed.data });
    if (res.status === 200) return res.body;
    return { found: null, reason: res.status === 401 ? "signed-out" : "error" };
  } catch {
    return { found: null, reason: "error" };
  }
}

/** Local e2e only (adminAuthMode() is "fake" only on a localhost SITE_URL with ADMIN_FAKE_AUTH=1). */
export async function fakeHelperSignIn(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  if (adminAuthMode() !== "fake") redirect(helperHref(locale, "/sign-in"));
  const user = field(fd, "user").replace(/[^A-Za-z0-9_]/g, "");
  const email = field(fd, "email").toLowerCase();
  (await cookies()).set(FAKE_COOKIE, `fake.${user}.${email}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect(helperHref(locale));
}

export async function fakeHelperSignOut(fd: FormData): Promise<void> {
  const jar = await cookies();
  jar.delete(FAKE_COOKIE);
  jar.delete(ADMIN_HINT_COOKIE);
  redirect(helperHref(localeOf(fd), "/sign-in"));
}
