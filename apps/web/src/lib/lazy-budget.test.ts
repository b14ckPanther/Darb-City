// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { groupFiles, loadableEntries } from "../../scripts/lazy-budget.mjs";

function fakeBuild() {
  const next = mkdtempSync(join(tmpdir(), "darb-next-"));
  const page = join(next, "server/app/[locale]/page");
  const kind = join(next, "server/app/[locale]/[place]/page");
  mkdirSync(page, { recursive: true });
  mkdirSync(kind, { recursive: true });
  const manifest = {
    "1": {
      id: 1,
      files: ["static/chunks/stage.js", "static/chunks/shared.js", "static/chunks/s.css"],
    },
    "2": { id: 2, files: ["static/chunks/search.js", "static/chunks/shared.js"] },
  };
  writeFileSync(join(page, "react-loadable-manifest.json"), JSON.stringify(manifest));
  // The same import seen from another route: counted once.
  writeFileSync(join(kind, "react-loadable-manifest.json"), JSON.stringify({ "1": manifest["1"] }));
  // Turbopack names a route-specific chunk for an import whose modules the route already holds
  // (/search holds the engine), and never emits it: it must not replace the emitted one.
  const search = join(next, "server/app/[locale]/search/page");
  mkdirSync(search, { recursive: true });
  writeFileSync(
    join(search, "react-loadable-manifest.json"),
    JSON.stringify({ "2": { id: 2, files: ["static/chunks/never-emitted.js"] } }),
  );
  mkdirSync(join(next, "static/chunks"), { recursive: true });
  for (const file of ["stage.js", "search.js", "shared.js", "s.css"])
    writeFileSync(join(next, "static/chunks", file), "");
  return next;
}

const code: Record<string, string> = {
  "static/chunks/stage.js": 'x="darb:stage-chunk"',
  "static/chunks/search.js": 'y="darb:search-chunk"',
  "static/chunks/shared.js": "z=1",
};
const read = (file: string) => code[file] ?? "";

describe("lazy groups", () => {
  it("reads every route's loadable manifest, JS files only, one entry per import", () => {
    const entries = loadableEntries(fakeBuild());
    expect(entries).toHaveLength(2);
    expect(entries.flat()).not.toContain("static/chunks/s.css");
  });

  it("skips chunks the build never emitted, keeping the import's emitted files", () => {
    const entries = loadableEntries(fakeBuild());
    expect(entries.flat()).not.toContain("static/chunks/never-emitted.js");
    expect(entries).toContainEqual(["static/chunks/search.js", "static/chunks/shared.js"]);
  });

  it("puts each import's files in the group whose marker it carries", () => {
    const entries = loadableEntries(fakeBuild());
    expect([...groupFiles(entries, "darb:stage-chunk", read)].sort()).toEqual([
      "static/chunks/shared.js",
      "static/chunks/stage.js",
    ]);
    expect([...groupFiles(entries, "darb:search-chunk", read)].sort()).toEqual([
      "static/chunks/search.js",
      "static/chunks/shared.js",
    ]);
  });

  it("is empty when no import carries the marker", () => {
    expect(groupFiles(loadableEntries(fakeBuild()), "darb:nothing", read).size).toBe(0);
  });
});
