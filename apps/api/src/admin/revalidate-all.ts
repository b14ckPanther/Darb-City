import "dotenv/config";
import { loadConfig } from "../config.js";
import { WebRevalidator } from "./revalidator.js";

// After a production seed or data fix: refresh every cached page (these three tags cover them all).
const ok = await new WebRevalidator(loadConfig(process.env)).revalidate([
  "taxonomy",
  "places",
  "businesses",
]);
console.log(
  ok ? "Web revalidated" : "Web revalidation failed (check REVALIDATE_URL and REVALIDATE_SECRET)",
);
process.exit(ok ? 0 : 1);
