import { expect, it } from "vitest";
import { adminAuthMode, clerkOrigin } from "./mode";

it("uses Clerk when both keys are set", () => {
  expect(
    adminAuthMode({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x",
      CLERK_SECRET_KEY: "sk_test_x",
    }),
  ).toBe("clerk");
  expect(adminAuthMode({})).toBe("off");
});

it("allows fake auth on localhost only", () => {
  expect(adminAuthMode({ ADMIN_FAKE_AUTH: "1", SITE_URL: "http://localhost:3100" })).toBe("fake");
  expect(adminAuthMode({ ADMIN_FAKE_AUTH: "1", SITE_URL: "https://darb.co.il" })).toBe("off");
  expect(adminAuthMode({ ADMIN_FAKE_AUTH: "1" })).toBe("off");
});

it("derives Clerk's frontend API origin from the publishable key", () => {
  const key = `pk_live_${Buffer.from("clerk.darb.co.il$").toString("base64")}`;
  expect(clerkOrigin(key)).toBe("https://clerk.darb.co.il");
  expect(clerkOrigin(undefined)).toBeNull();
  expect(clerkOrigin("garbage")).toBeNull();
});
