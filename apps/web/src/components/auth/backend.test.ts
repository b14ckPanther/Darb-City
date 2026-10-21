import { describe, expect, it, vi } from "vitest";
import {
  readClerkError,
  signInBackend,
  signUpBackend,
  type SignInLike,
  type SignUpLike,
} from "./backend";

const ok = () => Promise.resolve<{ error: unknown }>({ error: null });
const apiError = (code: string, status = 422) => ({ status, errors: [{ code }] });

type Factor = { strategy: string; emailAddressId?: string };

function fakeSignIn(
  over: { supportedFirstFactors?: Factor[]; supportedSecondFactors?: Factor[] } = {},
) {
  return {
    status: "needs_first_factor",
    supportedFirstFactors: [{ strategy: "email_code", emailAddressId: "idn_1" }] as Factor[],
    supportedSecondFactors: [] as Factor[],
    create: vi.fn(ok),
    password: vi.fn(ok),
    emailCode: { sendCode: vi.fn(ok), verifyCode: vi.fn(ok) },
    mfa: {
      sendEmailCode: vi.fn(ok),
      verifyEmailCode: vi.fn(ok),
      sendPhoneCode: vi.fn(ok),
      verifyPhoneCode: vi.fn(ok),
      verifyTOTP: vi.fn(ok),
    },
    finalize: vi.fn(ok),
    reset: vi.fn(ok),
    ...over,
  } satisfies SignInLike;
}

describe("readClerkError", () => {
  it("reads Clerk's codes as Darb's errors", () => {
    expect(readClerkError(apiError("form_identifier_not_found"))).toBe("notFound");
    expect(readClerkError(apiError("form_identifier_exists"))).toBe("exists");
    expect(readClerkError(apiError("form_code_incorrect"))).toBe("wrongCode");
    expect(readClerkError(apiError("verification_expired"))).toBe("expired");
    expect(readClerkError(apiError("anything", 429))).toBe("tooMany");
    expect(readClerkError(apiError("form_password_pwned"))).toBe("pwned");
    expect(readClerkError({ code: "session_exists" })).toBe("signedIn");
    expect(readClerkError(new Error("offline"))).toBe("generic");
    expect(readClerkError(null)).toBe("generic");
  });
});

describe("sign-in", () => {
  it("sends an email code when Clerk offers one, and finishes on the right code", async () => {
    const s = fakeSignIn();
    const go = vi.fn();
    const b = signInBackend(s, "/helpers", go);
    expect(await b.start("rami@example.com")).toEqual({
      ok: true,
      step: "code",
      channel: "email",
      canSwitch: false,
      resendable: true,
    });
    expect(s.create).toHaveBeenCalledWith({ identifier: "rami@example.com" });
    expect(s.emailCode.sendCode).toHaveBeenCalledWith({ emailAddressId: "idn_1" });
    s.emailCode.verifyCode.mockImplementation(() => {
      s.status = "complete";
      return ok();
    });
    expect(await b.code("786783")).toEqual({ ok: true, step: "done" });
    expect(s.emailCode.verifyCode).toHaveBeenCalledWith({ code: "786783" });
    s.finalize.mockImplementation((async (p?: Parameters<SignInLike["finalize"]>[0]) => {
      await p?.navigate?.({ decorateUrl: (u: string) => u });
      return { error: null };
    }) as typeof ok);
    expect(await b.finish()).toEqual({ ok: true, step: "done" });
    expect(go).toHaveBeenCalledWith("/helpers");
  });

  it("reads the password from Clerk's factors and lets the person switch", async () => {
    const s = fakeSignIn({
      supportedFirstFactors: [
        { strategy: "email_code", emailAddressId: "idn_1" },
        { strategy: "password" },
      ],
    });
    const b = signInBackend(s, "/admin", vi.fn());
    expect(await b.start("a@b.co")).toMatchObject({ step: "code", canSwitch: true });
    expect(await b.switchMethod("password")).toEqual({
      ok: true,
      step: "password",
      isNew: false,
      canSwitch: true,
    });
    const only = fakeSignIn({ supportedFirstFactors: [{ strategy: "password" }] });
    expect(await signInBackend(only, "/admin", vi.fn()).start("a@b.co")).toMatchObject({
      step: "password",
      canSwitch: false,
    });
    expect(only.emailCode.sendCode).not.toHaveBeenCalled();
  });

  it("asks for a second factor's code when Clerk needs one", async () => {
    const s = fakeSignIn({
      supportedFirstFactors: [{ strategy: "password" }],
      supportedSecondFactors: [{ strategy: "email_code" }],
    });
    s.password.mockImplementation(() => {
      s.status = "needs_client_trust";
      return ok();
    });
    const b = signInBackend(s, "/admin", vi.fn());
    await b.start("a@b.co");
    expect(await b.password("secret")).toMatchObject({ step: "code", channel: "email" });
    expect(s.mfa.sendEmailCode).toHaveBeenCalled();
    s.mfa.verifyEmailCode.mockImplementation(() => {
      s.status = "complete";
      return ok();
    });
    expect(await b.code("123456")).toEqual({ ok: true, step: "done" });
    expect(s.emailCode.verifyCode).not.toHaveBeenCalled();
  });

  it("returns Clerk's errors: unknown email, wrong code, rate limit, a thrown error", async () => {
    const s = fakeSignIn();
    s.create.mockResolvedValueOnce({ error: apiError("form_identifier_not_found") });
    const b = signInBackend(s, "/helpers", vi.fn());
    expect(await b.start("new@example.com")).toEqual({ ok: false, error: "notFound" });
    await b.start("rami@example.com");
    s.emailCode.verifyCode.mockResolvedValueOnce({
      error: apiError("form_code_incorrect") as never,
    });
    expect(await b.code("000000")).toEqual({ ok: false, error: "wrongCode" });
    s.emailCode.sendCode.mockResolvedValueOnce({ error: apiError("x", 429) });
    expect(await b.resend()).toEqual({ ok: false, error: "tooMany" });
    s.emailCode.verifyCode.mockRejectedValueOnce(new Error("network"));
    expect(await b.code("111111")).toEqual({ ok: false, error: "generic" });
  });
});

describe("sign-up", () => {
  function fakeSignUp(missing: string[]) {
    const u = {
      status: "missing_requirements" as string | null,
      emailAddress: null as string | null,
      missingFields: missing,
      unverifiedFields: ["email_address"] as string[],
      create: vi.fn(ok),
      password: vi.fn(ok),
      verifications: { sendEmailCode: vi.fn(ok), verifyEmailCode: vi.fn(ok) },
      finalize: vi.fn(ok),
      reset: vi.fn(ok),
    };
    return u satisfies SignUpLike;
  }

  it("verifies the email with a code and finishes", async () => {
    const u = fakeSignUp([]);
    const b = signUpBackend(u, "/helpers", vi.fn());
    expect(await b.start("new@example.com")).toMatchObject({ step: "code", channel: "email" });
    expect(u.create).toHaveBeenCalledWith({ emailAddress: "new@example.com" });
    expect(u.verifications.sendEmailCode).toHaveBeenCalledOnce();
    u.verifications.verifyEmailCode.mockImplementation(() => {
      u.status = "complete";
      return ok();
    });
    expect(await b.code("123456")).toEqual({ ok: true, step: "done" });
  });

  it("asks for a password first when the instance requires one", async () => {
    const u = fakeSignUp(["password"]);
    const b = signUpBackend(u, "/helpers", vi.fn());
    expect(await b.start("new@example.com")).toEqual({
      ok: true,
      step: "password",
      isNew: true,
      canSwitch: false,
    });
    expect(u.verifications.sendEmailCode).not.toHaveBeenCalled();
    u.password.mockImplementation(() => {
      u.missingFields = [];
      return ok();
    });
    expect(await b.password("a long password")).toMatchObject({ step: "code" });
    expect(u.password).toHaveBeenCalledWith({
      password: "a long password",
      emailAddress: "new@example.com",
    });
  });

  it("sends the attempt's email with the password when the page rebuilt the backend", async () => {
    const u = fakeSignUp(["password"]);
    await signUpBackend(u, "/helpers", vi.fn()).start("new@example.com");
    u.emailAddress = "new@example.com";
    await signUpBackend(u, "/helpers", vi.fn()).password("a long password");
    expect(u.password).toHaveBeenCalledWith({
      password: "a long password",
      emailAddress: "new@example.com",
    });
  });

  it("says when the email already has an account, or a field it cannot ask for is missing", async () => {
    const u = fakeSignUp([]);
    u.create.mockResolvedValueOnce({ error: apiError("form_identifier_exists") });
    expect(await signUpBackend(u, "/helpers", vi.fn()).start("old@example.com")).toEqual({
      ok: false,
      error: "exists",
    });
    const odd = fakeSignUp(["username"]);
    odd.unverifiedFields = [];
    expect(await signUpBackend(odd, "/helpers", vi.fn()).start("x@example.com")).toEqual({
      ok: false,
      error: "unsupported",
    });
  });
});
