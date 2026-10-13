import { config } from "dotenv";
import { TEST_REDIS_DB } from "./redis-db.js";

// A vitest setup file: runs before every test file loads its config.
config({ path: new URL("../.env", import.meta.url) });
const url = new URL(process.env["REDIS_URL"] || "redis://localhost:6380");
url.pathname = `/${TEST_REDIS_DB}`;
process.env["REDIS_URL"] = url.toString();
