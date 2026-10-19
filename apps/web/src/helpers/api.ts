import "server-only";
import { contract, type HelperMeDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { initClient, type ApiFetcher } from "@ts-rest/core";
import { redirect } from "next/navigation";
import { adminToken } from "@/admin/auth";
import { adminAuthMode } from "@/admin/mode";
import { helperHref } from "./routes";

/** Helper reads are never cached: every request sees the database (and its own person). */
const noStore: ApiFetcher = async ({ path, method, headers, body }) => {
  const res = await fetch(path, { method, headers, body, cache: "no-store" });
  const type = res.headers.get("content-type") ?? "";
  return {
    status: res.status,
    body: type.includes("json") ? await res.json() : await res.text(),
    headers: res.headers,
  };
};

/** The helper routes with the signed-in person's own token (the same session as the admin's). */
export async function helperApi() {
  const base = (process.env.API_URL ?? "").replace(/\/+$/, "");
  const token = (await adminToken()) ?? "";
  return initClient(contract.helpers, {
    baseUrl: base,
    baseHeaders: { authorization: `Bearer ${token}` },
    api: noStore,
    throwOnUnknownStatus: true,
  });
}

export type HelperSession =
  | { status: "ok"; me: HelperMeDto }
  | { status: "signed-out" }
  | { status: "off" }
  | { status: "unavailable" };

/** Who is here, as the API sees them: their helper state decides the home screen. */
export async function helperSession(): Promise<HelperSession> {
  if (adminAuthMode() === "off") return { status: "off" };
  if (!(await adminToken())) return { status: "signed-out" };
  try {
    const res = await (await helperApi()).me();
    if (res.status === 200) return { status: "ok", me: res.body };
    return { status: "signed-out" };
  } catch {
    return { status: "unavailable" };
  }
}

/** The session's person, or the sign-in page; null when sign-in is off or the API is down. */
export async function helperOrSignIn(
  locale: Locale,
): Promise<Exclude<HelperSession, { status: "signed-out" }>> {
  const session = await helperSession();
  if (session.status === "signed-out") redirect(helperHref(locale, "/sign-in"));
  return session;
}

/** Adding, for approved helpers and admins (admins are helpers too, without applying). */
export const canAdd = (me: HelperMeDto) => me.isAdmin || me.status === "approved";
/** Their own list, also while paused. */
export const canReadOwn = (me: HelperMeDto) => canAdd(me) || me.status === "paused";
