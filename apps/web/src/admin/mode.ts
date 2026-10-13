type Env = Partial<Record<string, string | undefined>>;

export type AdminAuthMode = "clerk" | "fake" | "off";
export const FAKE_COOKIE = "darb_admin_fake";

const localHost = (url: string | undefined) => {
  try {
    const host = new URL(url ?? "").hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
};

/** Clerk in every deployment; fake sign-in only for local e2e (never on a public host). */
export function adminAuthMode(env: Env = process.env): AdminAuthMode {
  if (env.ADMIN_FAKE_AUTH === "1") return localHost(env.SITE_URL) ? "fake" : "off";
  return env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY ? "clerk" : "off";
}

/** A publishable key is pk_<env>_<base64 of "<frontend api host>$">. */
export function clerkOrigin(publishableKey: string | undefined): string | null {
  const encoded = publishableKey?.split("_")[2];
  if (!encoded) return null;
  try {
    const host = atob(encoded).replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}
