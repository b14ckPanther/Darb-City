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

it("points at icons that exist", () => {
  for (const icon of helperManifest("en").icons)
    expect(existsSync(join(ICON_DIR, icon.src.split("/").pop()!)), icon.src).toBe(true);
});
