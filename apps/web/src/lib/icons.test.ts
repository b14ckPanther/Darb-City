// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { ICON_DIR, renderIcons } from "../../scripts/make-icons.mjs";

it("commits exactly the icons scripts/make-icons.mjs draws", async () => {
  const files = await renderIcons();
  const stale = Object.entries(files)
    .filter(([name, data]) => !readFileSync(join(ICON_DIR, name)).equals(data))
    .map(([name]) => name);
  expect(stale).toEqual([]);
}, 60_000);
