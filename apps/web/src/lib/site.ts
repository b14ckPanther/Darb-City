import "server-only";

type Env = Partial<Record<string, string | undefined>>;

/** The public origin, without a trailing slash. Production must say it (or be a Vercel preview). */
export function siteUrl(env: Env = process.env): string {
  const explicit = env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  if (env.NODE_ENV === "production")
    throw new Error("SITE_URL is not set: production needs the public origin (https://darb.co.il)");
  return "http://localhost:3000";
}

export function isLocalSite(env: Env = process.env): boolean {
  const url = env.SITE_URL?.trim();
  if (!url) return env.NODE_ENV !== "production";
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * Only the production deployment is indexed; previews and staging are noindex (Task 22). With a
 * request host, only the public origin is: production also answers on `*.vercel.app`.
 */
export function indexable(env: Env = process.env, host?: string | null): boolean {
  const on = env.VERCEL_ENV ? env.VERCEL_ENV === "production" : env.SITE_INDEXABLE === "1";
  if (!on || host == null) return on;
  const site = env.SITE_URL?.trim();
  return !!site && new URL(site).host === host.toLowerCase();
}
