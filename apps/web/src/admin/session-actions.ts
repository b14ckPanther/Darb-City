"use server";

import { isLocale } from "@/lib/locale";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_HINT_COOKIE } from "./marker";
import { adminAuthMode, FAKE_COOKIE } from "./mode";
import { adminHref } from "./routes";

/** Local e2e only: adminAuthMode() is "fake" only on a localhost SITE_URL with ADMIN_FAKE_AUTH=1. */
export async function fakeSignIn(formData: FormData): Promise<void> {
  const raw = String(formData.get("locale") ?? "he");
  const locale = isLocale(raw) ? raw : "he";
  if (adminAuthMode() !== "fake") redirect(adminHref(locale, "/sign-in"));
  const user = String(formData.get("user") ?? "").replace(/[^A-Za-z0-9_]/g, "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  (await cookies()).set(FAKE_COOKIE, `fake.${user}.${email}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect(adminHref(locale));
}

export async function fakeSignOut(formData: FormData): Promise<void> {
  const raw = String(formData.get("locale") ?? "he");
  const jar = await cookies();
  jar.delete(FAKE_COOKIE);
  jar.delete(ADMIN_HINT_COOKIE);
  redirect(adminHref(isLocale(raw) ? raw : "he", "/sign-in"));
}
