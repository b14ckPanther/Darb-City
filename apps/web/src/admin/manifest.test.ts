// @vitest-environment node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { ICON_DIR } from "../../scripts/make-icons.mjs";
import { helperManifest } from "@/helpers/manifest";
import { manifest } from "@/lib/pwa";
import { adminManifest } from "./manifest";
import { GET } from "@/app/api/admin/manifest/[locale]/route";

it("installs apart from the site and the helper app: its own id, start page and scope", () => {
  expect(adminManifest("he")).toMatchObject({
    id: "/admin",
    start_url: "/admin",
    scope: "/admin",
    lang: "he",
    dir: "rtl",
    display: "standalone",
    name: "ניהול דרב",
  });
  expect(adminManifest("ar")).toMatchObject({ start_url: "/ar/admin", scope: "/ar/admin" });
  expect(adminManifest("en")).toMatchObject({ id: "/en/admin", name: "Darb admin" });
  const ids = new Set([adminManifest("en").id, helperManifest("en").id, manifest("en").id]);
  expect(ids.size).toBe(3);
});

it("has its own icons, every one of them on disk, never the helper's or the site's", () => {
  const m = adminManifest("en");
  const files = [...m.icons, ...m.shortcuts.flatMap((s) => s.icons)].map((i) => i.src);
  for (const src of files) {
    expect(src).toMatch(/\/admin-/);
    expect(existsSync(join(ICON_DIR, src.split("/").pop()!)), src).toBe(true);
  }
  expect(m.icons.some((i) => i.purpose === "maskable")).toBe(true);
  expect(m.shortcuts.every((s) => s.icons[0]!.sizes === "96x96")).toBe(true);
});

it("long press: add from the street, join requests, helpers, inside its scope", () => {
  expect(adminManifest("he").shortcuts.map((s) => [s.name, s.url])).toEqual([
    ["הוספה מהרחוב", "/admin/field"],
    ["בקשות הצטרפות", "/admin/join-requests"],
    ["עוזרים", "/admin/helpers"],
  ]);
  const ar = adminManifest("ar");
  for (const s of ar.shortcuts) expect(s.url.startsWith(ar.scope)).toBe(true);
});

it("serves the manifest per locale as a web manifest, and 404s an unknown locale", async () => {
  const ok = await GET(new Request("http://x"), { params: Promise.resolve({ locale: "ar" }) });
  expect(ok.headers.get("content-type")).toMatch(/application\/manifest\+json/);
  expect((await ok.json()).start_url).toBe("/ar/admin");
  const no = await GET(new Request("http://x"), { params: Promise.resolve({ locale: "fr" }) });
  expect(no.status).toBe(404);
});
