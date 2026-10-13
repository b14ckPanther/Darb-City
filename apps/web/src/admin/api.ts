import "server-only";
import { contract } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { initClient, type ApiFetcher } from "@ts-rest/core";
import { notFound, redirect } from "next/navigation";
import { adminToken } from "./auth";
import { adminAuthMode } from "./mode";
import { adminHref } from "./routes";

/** Admin reads are never cached: every request sees the database. */
const noStore: ApiFetcher = async ({ path, method, headers, body }) => {
  const res = await fetch(path, { method, headers, body, cache: "no-store" });
  const type = res.headers.get("content-type") ?? "";
  return {
    status: res.status,
    body: type.includes("json") ? await res.json() : await res.text(),
    headers: res.headers,
  };
};

export async function adminApi() {
  const base = (process.env.API_URL ?? "").replace(/\/+$/, "");
  const token = (await adminToken()) ?? "";
  return initClient(contract.admin, {
    baseUrl: base,
    baseHeaders: { authorization: `Bearer ${token}` },
    api: noStore,
    throwOnUnknownStatus: true,
  });
}
export type AdminClient = Awaited<ReturnType<typeof adminApi>>;

export type AdminSession =
  | { status: "ok"; clerkUserId: string }
  | { status: "signed-out" }
  | { status: "forbidden" }
  | { status: "off" };

export async function adminSession(): Promise<AdminSession> {
  if (adminAuthMode() === "off") return { status: "off" };
  if (!(await adminToken())) return { status: "signed-out" };
  const res = await (await adminApi()).misc.me();
  if (res.status === 200) return { status: "ok", clerkUserId: res.body.clerkUserId };
  return res.status === 403 ? { status: "forbidden" } : { status: "signed-out" };
}

/** The body of a 200/201, or the right navigation for anything else. */
export function okOr<T>(res: { status: number; body: unknown }, locale: Locale): T {
  if (res.status === 200 || res.status === 201) return res.body as T;
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  notFound();
}
