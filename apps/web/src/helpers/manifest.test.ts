// @vitest-environment node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { ICON_DIR } from "../../scripts/make-icons.mjs";
import { helperManifest } from "./manifest";

it("installs apart from the site: its own id, start page and scope on /helpers", () => {
  expect(helperManifest("he")).toMatchObject({
    id: "/helpers",
    start_url: "/helpers",
    scope: "/helpers",
    lang: "he",
    dir: "rtl",
    display: "standalone",
  });
  expect(helperManifest("en")).toMatchObject({ start_url: "/en/helpers", scope: "/en/helpers" });
  expect(helperManifest("ar").short_name).toBe("مساعدين درب");
});

it("points at icons that exist, its shortcuts' too", () => {
  const m = helperManifest("en");
  for (const icon of [...m.icons, ...m.shortcuts.flatMap((s) => s.icons)])
    expect(existsSync(join(ICON_DIR, icon.src.split("/").pop()!)), icon.src).toBe(true);
});

it("long press: straight to the camera, or to the list", () => {
  expect(helperManifest("he").shortcuts.map((s) => [s.name, s.url])).toEqual([
    ["הוספת עסק", "/helpers?camera=1"],
    ["מה הוספתי", "/helpers/mine"],
  ]);
  expect(helperManifest("ar").shortcuts[0]!.url).toBe("/ar/helpers?camera=1");
});

it("takes shared links and photos inside its own scope", () => {
  const m = helperManifest("en");
  expect(m.share_target).toMatchObject({
    action: "/en/helpers/share",
    method: "POST",
    enctype: "multipart/form-data",
    params: { url: "url", text: "text", files: [{ name: "photo", accept: ["image/*"] }] },
  });
  expect(m.share_target.action.startsWith(m.scope)).toBe(true);
});

it("shows install sheet screenshots that exist, labelled in the app's words", () => {
  const screens = join(ICON_DIR, "..", "screens");
  for (const locale of ["he", "ar", "en"] as const)
    for (const s of helperManifest(locale).screenshots) {
      expect(s).toMatchObject({ form_factor: "narrow", type: "image/webp", sizes: "1080x2340" });
      expect(existsSync(join(screens, s.src.split("/").pop()!)), s.src).toBe(true);
      expect(s.label.trim()).not.toBe("");
    }
});
