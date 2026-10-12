// Lazy (next/dynamic) chunks, grouped by the marker string each group's own code carries.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Every react-loadable-manifest.json under .next/server/app: the JS files of each import. */
export function loadableEntries(nextDir) {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name === "react-loadable-manifest.json" ? [path] : [];
    });
  const byId = new Map();
  for (const file of walk(join(nextDir, "server/app")))
    for (const [id, entry] of Object.entries(JSON.parse(readFileSync(file, "utf8"))))
      byId.set(
        String(id),
        (entry.files ?? []).filter((f) => f.endsWith(".js")),
      );
  return [...byId.values()];
}

/**
 * The files of every import whose code carries `marker`. An import's files include chunks it shares
 * with other imports, so each group is measured as it would load on its own.
 */
export function groupFiles(entries, marker, read) {
  const files = new Set();
  for (const list of entries)
    if (list.some((file) => read(file).includes(marker))) for (const file of list) files.add(file);
  return files;
}
