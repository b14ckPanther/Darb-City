// Copies the approved brand files from @darb/tokens into public/brand (served at /brand/*), and the
// legacy favicon.ico to the site root, where browsers look for it unasked.
import { copyFileSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("@darb/tokens/assets/brand/darb-mark-480.webp"));
const target = fileURLToPath(new URL("../public/brand", import.meta.url));
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
copyFileSync(
  `${source}/icons/favicon.ico`,
  fileURLToPath(new URL("../public/favicon.ico", import.meta.url)),
);
console.log(`brand: ${source} -> ${target}`);
