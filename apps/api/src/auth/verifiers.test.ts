import { expect, it, vi } from "vitest";
import { ClerkTokenVerifier } from "./clerk-token-verifier.js";
import { FakeTokenVerifier } from "./fake-token-verifier.js";
import { InvalidTokenError, verifierFor } from "./token-verifier.js";

const auth = {
  verifier: "clerk" as const,
  clerkSecretKey: "sk_test_x",
  clerkJwtKey: null,
  authorizedParties: ["https://darb.co.il"],
  adminEmails: [],
};

it("verifies with Clerk's verifyToken and reads the email claims", async () => {
  const verify = vi.fn(async () => ({
    sub: "user_1",
    email: "Founder@Darb.co.il",
    email_verified: true,
  }));
  const v = new ClerkTokenVerifier(auth, verify as never);
  expect(await v.verify("t")).toEqual({
    sub: "user_1",
    email: "founder@darb.co.il",
    emailVerified: true,
  });
  expect(verify).toHaveBeenCalledWith("t", {
    secretKey: "sk_test_x",
    authorizedParties: ["https://darb.co.il"],
  });
});

it("prefers the networkless JWT key", async () => {
  const verify = vi.fn(async () => ({ sub: "user_1" }));
  await new ClerkTokenVerifier({ ...auth, clerkJwtKey: "PEM" }, verify as never).verify("t");
  expect(verify).toHaveBeenCalledWith("t", {
    jwtKey: "PEM",
    authorizedParties: ["https://darb.co.il"],
  });
});

it("turns any verification failure into InvalidTokenError", async () => {
  const v = new ClerkTokenVerifier(auth, (async () => {
    throw new Error("expired");
  }) as never);
  await expect(v.verify("t")).rejects.toBeInstanceOf(InvalidTokenError);
});

it("reads fake tokens for tests", async () => {
  const fake = new FakeTokenVerifier();
  expect(await fake.verify("fake.user_a.a@darb.test")).toEqual({
    sub: "user_a",
    email: "a@darb.test",
    emailVerified: true,
  });
  expect(await fake.verify("fake.user_b.b@darb.test.unverified")).toEqual({
    sub: "user_b",
    email: "b@darb.test",
    emailVerified: false,
  });
  expect(await fake.verify("fake.user_c")).toEqual({
    sub: "user_c",
    email: null,
    emailVerified: false,
  });
  await expect(fake.verify("real-looking.jwt.token")).rejects.toBeInstanceOf(InvalidTokenError);
});

it("picks the verifier from config; off rejects everyone", async () => {
  expect(verifierFor({ ...auth, verifier: "fake" })).toBeInstanceOf(FakeTokenVerifier);
  expect(verifierFor(auth)).toBeInstanceOf(ClerkTokenVerifier);
  await expect(verifierFor({ ...auth, verifier: "off" }).verify("x")).rejects.toBeInstanceOf(
    InvalidTokenError,
  );
});
