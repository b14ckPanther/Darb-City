import { expect, it } from "vitest";
import { adminHintCookie, ADMIN_HINT_COOKIE, hasAdminHint } from "./marker";

it("reads the marker only when it is exactly set", () => {
  expect(hasAdminHint("")).toBe(false);
  expect(hasAdminHint("a=b; darb_admin_hint=0")).toBe(false);
  expect(hasAdminHint("a=b; darb_admin_hint=1")).toBe(true);
  expect(hasAdminHint("xdarb_admin_hint=1")).toBe(false);
});

it("writes a plain, lax, site-wide cookie, and clears it", () => {
  expect(adminHintCookie(true)).toBe(
    `${ADMIN_HINT_COOKIE}=1; path=/; max-age=2592000; samesite=lax; secure`,
  );
  expect(adminHintCookie(false, false)).toBe(
    `${ADMIN_HINT_COOKIE}=; path=/; max-age=0; samesite=lax`,
  );
  expect(adminHintCookie(true)).not.toMatch(/httponly/i);
});
