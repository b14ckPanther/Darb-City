/**
 * The "maybe an admin" marker for the public site. It is a plain cookie (not HttpOnly) that only
 * tells the public card to offer an Edit button; it grants nothing. Every read and write still
 * goes through the admin proxy and the API's Clerk guard.
 */
export const ADMIN_HINT_COOKIE = "darb_admin_hint";
const MONTH = 60 * 60 * 24 * 30;

export function hasAdminHint(cookie: string): boolean {
  return cookie.split(";").some((c) => c.trim() === `${ADMIN_HINT_COOKIE}=1`);
}

/** The Set-Cookie value written in the browser at admin sign-in (and refreshed on each visit). */
export function adminHintCookie(secure: boolean, on = true): string {
  return [
    `${ADMIN_HINT_COOKIE}=${on ? "1" : ""}`,
    "path=/",
    `max-age=${on ? MONTH : 0}`,
    "samesite=lax",
    ...(secure ? ["secure"] : []),
  ].join("; ");
}
