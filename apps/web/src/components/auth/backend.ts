/**
 * Darb's sign-in and sign-up flows over Clerk's sign-in and sign-up resources (the signal API of
 * `useSignIn` / `useSignUp`). The screens never talk to Clerk: they ask an AuthBackend for the next
 * step, so the same screens run on Clerk, in unit tests and in previews.
 *
 * Which steps a person sees comes from the Clerk instance itself: the first factors Clerk offers for
 * the email (code, password or both), the second factors it asks for, and the fields a sign-up is
 * still missing. Nothing here assumes how the instance is configured.
 */

export type CodeChannel = "email" | "phone" | "app";

export type AuthError =
  | "notFound"
  | "exists"
  | "wrongCode"
  | "expired"
  | "tooMany"
  | "wrongPassword"
  | "weakPassword"
  | "pwned"
  | "badEmail"
  | "unsupported"
  | "signedIn"
  | "generic";

export type Outcome =
  | { ok: true; step: "code"; channel: CodeChannel; canSwitch: boolean; resendable: boolean }
  | { ok: true; step: "password"; isNew: boolean; canSwitch: boolean }
  | { ok: true; step: "done" }
  | { ok: false; error: AuthError };

export interface AuthBackend {
  /** Starts with the email and returns the first step after it. */
  start(email: string): Promise<Outcome>;
  password(password: string): Promise<Outcome>;
  code(code: string): Promise<Outcome>;
  resend(): Promise<Outcome>;
  /** Sign-in only, when Clerk offers both: from the code to the password, or back. */
  switchMethod(to: "code" | "password"): Promise<Outcome>;
  /** Back to the email (clears Clerk's attempt; no request). */
  reset(): void;
  /** Makes the new session active and leaves the page. */
  finish(): Promise<Outcome>;
}

type Result = Promise<{ error: unknown }>;
type Factor = { strategy: string; emailAddressId?: string };

/** The parts of Clerk's SignInFutureResource this flow uses (the real one is assignable). */
export interface SignInLike {
  readonly status: string;
  readonly supportedFirstFactors: readonly Factor[] | null;
  readonly supportedSecondFactors: readonly Factor[] | null;
  create(params: { identifier: string }): Result;
  password(params: { password: string }): Result;
  emailCode: {
    sendCode(params?: { emailAddressId?: string }): Result;
    verifyCode(params: { code: string }): Result;
  };
  mfa: {
    sendEmailCode(): Result;
    verifyEmailCode(params: { code: string }): Result;
    sendPhoneCode(): Result;
    verifyPhoneCode(params: { code: string }): Result;
    verifyTOTP(params: { code: string }): Result;
  };
  finalize(params?: { navigate?: Navigate }): Result;
  reset(): Promise<unknown>;
}

/** The parts of Clerk's SignUpFutureResource this flow uses. */
export interface SignUpLike {
  readonly status: string | null;
  readonly emailAddress: string | null;
  readonly missingFields: readonly string[];
  readonly unverifiedFields: readonly string[];
  create(params: { emailAddress: string }): Result;
  password(params: { password: string; emailAddress: string }): Result;
  verifications: {
    sendEmailCode(): Result;
    verifyEmailCode(params: { code: string }): Result;
  };
  finalize(params?: { navigate?: Navigate }): Result;
  reset(): Promise<unknown>;
}

// Clerk hands navigate the new session and a URL decorator; only the decorator is used here.
type Navigate = (params: { decorateUrl: (url: string) => string }) => void | Promise<unknown>;

const CODE_ERRORS: Record<string, AuthError> = {
  form_identifier_not_found: "notFound",
  invitation_account_not_exists: "notFound",
  form_identifier_exists: "exists",
  form_code_incorrect: "wrongCode",
  verification_expired: "expired",
  verification_failed: "tooMany",
  too_many_requests: "tooMany",
  user_locked: "tooMany",
  form_password_incorrect: "wrongPassword",
  form_password_pwned: "pwned",
  form_password_length_too_short: "weakPassword",
  form_password_not_strong_enough: "weakPassword",
  form_password_validation_failed: "weakPassword",
  form_password_size_in_bytes_exceeded: "weakPassword",
  form_param_format_invalid: "badEmail",
  form_identifier_invalid: "badEmail",
  form_email_address_blocked: "badEmail",
  session_exists: "signedIn",
};

/** Reads a Clerk error (an API response error, a runtime error, or anything thrown) as Darb's. */
export function readClerkError(error: unknown): AuthError {
  if (!error || typeof error !== "object") return "generic";
  const e = error as { status?: number; code?: string; errors?: { code?: string }[] };
  if (e.status === 429) return "tooMany";
  for (const code of [...(e.errors ?? []).map((x) => x.code), e.code])
    if (code && CODE_ERRORS[code]) return CODE_ERRORS[code];
  return "generic";
}

async function run(call: Result): Promise<AuthError | null> {
  try {
    const { error } = await call;
    return error ? readClerkError(error) : null;
  } catch (error) {
    return readClerkError(error);
  }
}

const fail = (error: AuthError): Outcome => ({ ok: false, error });
const has = (factors: readonly Factor[] | null, strategy: string) =>
  (factors ?? []).find((f) => f.strategy === strategy);

/** Where finalize goes: an absolute URL loads the page; a path goes through the app router. */
export type Go = (url: string) => void;
const navigateTo =
  (target: string, go: Go): Navigate =>
  ({ decorateUrl }) =>
    go(decorateUrl(target));

export function signInBackend(signIn: SignInLike, target: string, go: Go): AuthBackend {
  // Which code the code screen verifies: the first factor, or a second factor Clerk asks for.
  let codeFor: "first" | "email2" | "phone2" | "totp" = "first";
  let emailAddressId: string | undefined;

  const methods = () => ({
    code: has(signIn.supportedFirstFactors, "email_code"),
    password: Boolean(has(signIn.supportedFirstFactors, "password")),
  });

  async function sendFirstCode(): Promise<Outcome> {
    codeFor = "first";
    const err = await run(signIn.emailCode.sendCode(emailAddressId ? { emailAddressId } : {}));
    if (err) return fail(err);
    return {
      ok: true,
      step: "code",
      channel: "email",
      canSwitch: methods().password,
      resendable: true,
    };
  }

  async function afterFactor(): Promise<Outcome> {
    const status = signIn.status;
    if (status === "complete") return { ok: true, step: "done" };
    if (status !== "needs_second_factor" && status !== "needs_client_trust")
      return fail("unsupported");
    const second = signIn.supportedSecondFactors;
    if (has(second, "email_code")) {
      const err = await run(signIn.mfa.sendEmailCode());
      if (err) return fail(err);
      codeFor = "email2";
      return { ok: true, step: "code", channel: "email", canSwitch: false, resendable: true };
    }
    if (has(second, "totp")) {
      codeFor = "totp";
      return { ok: true, step: "code", channel: "app", canSwitch: false, resendable: false };
    }
    if (has(second, "phone_code")) {
      const err = await run(signIn.mfa.sendPhoneCode());
      if (err) return fail(err);
      codeFor = "phone2";
      return { ok: true, step: "code", channel: "phone", canSwitch: false, resendable: true };
    }
    return fail("unsupported");
  }

  return {
    async start(email) {
      const err = await run(signIn.create({ identifier: email }));
      if (err) return fail(err);
      const { code, password } = methods();
      emailAddressId = code?.emailAddressId;
      if (code) return sendFirstCode();
      if (password) return { ok: true, step: "password", isNew: false, canSwitch: false };
      return fail("unsupported");
    },
    async password(password) {
      const err = await run(signIn.password({ password }));
      return err ? fail(err) : afterFactor();
    },
    async code(code) {
      const call =
        codeFor === "email2"
          ? signIn.mfa.verifyEmailCode({ code })
          : codeFor === "phone2"
            ? signIn.mfa.verifyPhoneCode({ code })
            : codeFor === "totp"
              ? signIn.mfa.verifyTOTP({ code })
              : signIn.emailCode.verifyCode({ code });
      const err = await run(call);
      return err ? fail(err) : afterFactor();
    },
    async resend() {
      if (codeFor === "first") return sendFirstCode();
      const call = codeFor === "phone2" ? signIn.mfa.sendPhoneCode() : signIn.mfa.sendEmailCode();
      const err = await run(call);
      if (err) return fail(err);
      return {
        ok: true,
        step: "code",
        channel: codeFor === "phone2" ? "phone" : "email",
        canSwitch: false,
        resendable: true,
      };
    },
    async switchMethod(to) {
      const { code, password } = methods();
      if (to === "password" && password)
        return { ok: true, step: "password", isNew: false, canSwitch: Boolean(code) };
      if (to === "code" && code) return sendFirstCode();
      return fail("unsupported");
    },
    reset() {
      codeFor = "first";
      emailAddressId = undefined;
      void signIn.reset();
    },
    async finish() {
      const err = await run(signIn.finalize({ navigate: navigateTo(target, go) }));
      return err ? fail(err) : { ok: true, step: "done" };
    },
  };
}

export function signUpBackend(signUp: SignUpLike, target: string, go: Go): AuthBackend {
  let sent = false;
  let emailAddress = "";

  async function next(): Promise<Outcome> {
    if (signUp.status === "complete") return { ok: true, step: "done" };
    const missing = signUp.missingFields ?? [];
    if (missing.includes("password"))
      return { ok: true, step: "password", isNew: true, canSwitch: false };
    if ((signUp.unverifiedFields ?? []).includes("email_address")) {
      if (!sent) {
        const err = await run(signUp.verifications.sendEmailCode());
        if (err) return fail(err);
        sent = true;
      }
      return { ok: true, step: "code", channel: "email", canSwitch: false, resendable: true };
    }
    return fail("unsupported");
  }

  return {
    async start(email) {
      sent = false;
      emailAddress = email;
      const err = await run(signUp.create({ emailAddress: email }));
      return err ? fail(err) : next();
    },
    async password(password) {
      // The page rebuilds this backend whenever Clerk's resource changes, which empties
      // `emailAddress`; the attempt itself still holds it. Sending "" fails with "Enter email address".
      const email = emailAddress || signUp.emailAddress || "";
      const err = await run(signUp.password({ password, emailAddress: email }));
      return err ? fail(err) : next();
    },
    async code(code) {
      const err = await run(signUp.verifications.verifyEmailCode({ code }));
      return err ? fail(err) : next();
    },
    async resend() {
      const err = await run(signUp.verifications.sendEmailCode());
      if (err) return fail(err);
      return { ok: true, step: "code", channel: "email", canSwitch: false, resendable: true };
    },
    async switchMethod() {
      return fail("unsupported");
    },
    reset() {
      sent = false;
      void signUp.reset();
    },
    async finish() {
      const err = await run(signUp.finalize({ navigate: navigateTo(target, go) }));
      return err ? fail(err) : { ok: true, step: "done" };
    },
  };
}
