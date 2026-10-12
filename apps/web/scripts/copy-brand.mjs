// Copies the approved brand files from @darb/tokens into public/brand (served at /brand/*).
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("@darb/tokens/assets/brand/icon-32.png"));
const target = fileURLToPath(new URL("../public/brand", import.meta.url));
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`brand: ${source} -> ${target}`);
