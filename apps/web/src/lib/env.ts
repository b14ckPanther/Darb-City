import "server-only";
import { isLocalSite, siteUrl } from "./site";

type Env = Partial<Record<string, string | undefined>>;

/**
 * Refuses to serve production with development secrets (Plan 3 blocker; Plan 4 Task 18).
 * Every production server needs SEARCH_PROXY_KEY: without it the API cannot tell visitors apart,
 * so all of them share the web server's suggest bucket and suggestions quietly go empty.
 */
export function assertServerEnv(env: Env = process.env): void {
  const proxyKey = env.SEARCH_PROXY_KEY?.trim() ?? "";
  if (env.NODE_ENV !== "production") {
    if (!proxyKey)
      console.warn(
        "SEARCH_PROXY_KEY is not set: the API rate-limits every visitor as this one server (see apps/web/.env.example)",
      );
    return;
  }
  if (isLocalSite(env)) {
    if (!proxyKey) throw new Error("Invalid web environment: SEARCH_PROXY_KEY is not set");
    return;
  }
  const problems: string[] = [];
  try {
    siteUrl(env);
  } catch (e) {
    problems.push((e as Error).message);
  }
  if (!env.API_URL) problems.push("API_URL is not set");
  if (proxyKey.length < 32)
    problems.push("SEARCH_PROXY_KEY must be the API's random secret of at least 32 characters");
  if ((env.REVALIDATE_SECRET ?? "").length < 32)
    problems.push("REVALIDATE_SECRET must be a random secret of at least 32 characters");
  if (problems.length) throw new Error(`Invalid web environment: ${problems.join("; ")}`);
}
