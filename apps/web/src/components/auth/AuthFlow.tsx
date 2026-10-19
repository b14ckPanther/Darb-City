"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { AuthBackend, AuthError, CodeChannel, Outcome } from "./backend";
import { fill, type AuthKey } from "./auth-copy";
import { CODE_LENGTH, CodeField } from "./CodeField";
import styles from "./Auth.module.css";

type Step = "email" | "password" | "code" | "done";
const RESEND_SECONDS = 30;
/** How long the gold "you are in" moment shows before the page moves on. */
const DONE_MS = 900;

const ERROR_KEY: Record<Exclude<AuthError, "signedIn">, AuthKey> = {
  notFound: "errNotFound",
  exists: "errExists",
  wrongCode: "errWrongCode",
  expired: "errExpired",
  tooMany: "errTooMany",
  wrongPassword: "errWrongPassword",
  weakPassword: "errWeakPassword",
  pwned: "errPwned",
  badEmail: "errBadEmail",
  unsupported: "errUnsupported",
  generic: "errGeneric",
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Darb's sign-in and sign-up, one question at a time: the email, then a code (or a password, when
 * Clerk asks for one), then a short gold moment and the app. `other` is the other flow's page
 * (sign-up from sign-in and back); without it (the admin) there is no way to sign up.
 */
export function AuthFlow({
  kind,
  backend,
  copy,
  other,
  initialEmail = "",
  onSignedIn,
}: {
  kind: "sign-in" | "sign-up";
  backend: AuthBackend;
  copy: Record<AuthKey, string>;
  other?: string | null;
  initialEmail?: string;
  /** Called when Clerk says this browser is already signed in. */
  onSignedIn: () => void;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [channel, setChannel] = useState<CodeChannel>("email");
  const [canSwitch, setCanSwitch] = useState(false);
  const [resendable, setResendable] = useState(true);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [notice, setNotice] = useState("");
  const [wait, setWait] = useState(0);
  const [shake, setShake] = useState(0);
  const field = useRef<HTMLInputElement>(null);

  // Each step puts the cursor in its one field.
  useEffect(() => {
    if (step !== "done") field.current?.focus();
  }, [step]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function settle(outcome: Outcome) {
    if (!outcome.ok) {
      if (outcome.error === "signedIn") return onSignedIn();
      setError(outcome.error);
      if (outcome.error === "wrongCode") {
        setCode("");
        setShake((n) => n + 1);
        field.current?.focus();
      }
      return;
    }
    setError(null);
    if (outcome.step === "done") {
      setStep("done");
      await new Promise((r) => setTimeout(r, reducedMotion() ? 0 : DONE_MS));
      const finished = await backend.finish();
      if (!finished.ok) {
        if (finished.error === "signedIn") return onSignedIn();
        setStep("email");
        setError(finished.error);
      }
      return;
    }
    if (outcome.step === "code") {
      setChannel(outcome.channel);
      setResendable(outcome.resendable);
      setCode("");
      setWait(outcome.resendable ? RESEND_SECONDS : 0);
    } else {
      setIsNew(outcome.isNew);
      setPassword("");
    }
    setCanSwitch(outcome.canSwitch);
    setStep(outcome.step);
  }

  async function act(call: () => Promise<Outcome>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await settle(await call());
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  }

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("badEmail");
      field.current?.focus();
      return;
    }
    void act(() => backend.start(value));
  };
  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    if (password) void act(() => backend.password(password));
  };
  const submitCode = (value: string) => {
    if (value.length === CODE_LENGTH) void act(() => backend.code(value));
  };
  const resend = () =>
    act(async () => {
      const outcome = await backend.resend();
      if (outcome.ok) setNotice(copy.resent);
      return outcome;
    });
  const changeEmail = () => {
    backend.reset();
    setError(null);
    setNotice("");
    setCode("");
    setPassword("");
    setStep("email");
  };

  const errorText = error && error !== "signedIn" ? copy[errorKey(error, kind, other)] : "";
  const errorLink: ReactNode =
    other && error === (kind === "sign-in" ? "notFound" : "exists") ? (
      <Link
        className={styles.errorLink}
        href={`${other}?email=${encodeURIComponent(email.trim())}`}
      >
        {kind === "sign-in" ? copy.toSignUp : copy.toSignIn}
      </Link>
    ) : null;
  const errorId = errorText ? "auth-error" : undefined;
  const errorLine = (
    <p id="auth-error" className={styles.error} role="alert" aria-live="assertive">
      {errorText ? (
        <>
          <span>{errorText}</span> {errorLink}
        </>
      ) : null}
    </p>
  );
  const submit = (label: string) => (
    <button className={styles.submit} type="submit" disabled={busy} aria-busy={busy || undefined}>
      <span>{busy ? copy.working : label}</span>
      <svg className={styles.arrow} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M5 12h14m-5-5 5 5-5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
  const lit = step === "email" ? 1 : step === "done" ? 3 : 2;

  return (
    <div className={styles.flow} data-step={step} data-auth-done={step === "done" ? "" : undefined}>
      <div className={styles.road} aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <i key={n} data-lit={n <= lit ? "" : undefined} />
        ))}
      </div>

      {step === "email" ? (
        <form key="email" className={styles.step} onSubmit={submitEmail} noValidate>
          <label className={styles.question} htmlFor="auth-email">
            {copy.emailLabel}
          </label>
          <p className={styles.hint} id="auth-email-hint">
            {copy.emailHint}
          </p>
          <input
            ref={field}
            id="auth-email"
            className={styles.input}
            name="email"
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete={kind === "sign-in" ? "username" : "email"}
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@example.com"
            required
            value={email}
            aria-invalid={error ? true : undefined}
            aria-describedby={["auth-email-hint", errorId].filter(Boolean).join(" ")}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
          />
          {errorLine}
          {submit(copy.continue)}
        </form>
      ) : null}

      {step === "password" ? (
        <form key="password" className={styles.step} onSubmit={submitPassword}>
          <Who email={email} change={copy.changeEmail} onChange={changeEmail} />
          <label className={styles.question} htmlFor="auth-password">
            {isNew ? copy.newPasswordLabel : copy.passwordLabel}
          </label>
          {isNew ? (
            <p className={styles.hint} id="auth-password-hint">
              {copy.newPasswordHint}
            </p>
          ) : null}
          {/* Password managers pair the password with this email. */}
          <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
          {/* Left to right like the field, so the eye sits on its right edge on every page. */}
          <div className={styles.password} dir="ltr">
            <input
              ref={field}
              id="auth-password"
              className={styles.input}
              name="password"
              type={showPassword ? "text" : "password"}
              dir="ltr"
              autoComplete={isNew ? "new-password" : "current-password"}
              required
              minLength={isNew ? 8 : undefined}
              value={password}
              aria-invalid={error ? true : undefined}
              aria-describedby={
                [isNew ? "auth-password-hint" : "", errorId].filter(Boolean).join(" ") || undefined
              }
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
            />
            <button
              type="button"
              className={styles.reveal}
              aria-pressed={showPassword}
              aria-label={showPassword ? copy.hidePassword : copy.showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  d={
                    showPassword
                      ? "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.6 4.3 9.6 6-.5.8-1.5 2.2-2.9 3.5M6.5 7.6C4.6 8.9 3.1 10.8 2.4 12c1 1.7 4.6 6 9.6 6 1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"
                      : "M2.4 12C3.4 10.3 7 6 12 6s8.6 4.3 9.6 6c-1 1.7-4.6 6-9.6 6s-8.6-4.3-9.6-6Zm9.6 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                  }
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {errorLine}
          {submit(isNew ? copy.continue : copy.signIn)}
          {canSwitch ? (
            <button
              type="button"
              className={styles.textButton}
              disabled={busy}
              onClick={() => act(() => backend.switchMethod("code"))}
            >
              {copy.useCode}
            </button>
          ) : null}
        </form>
      ) : null}

      {step === "code" ? (
        <form
          key="code"
          className={styles.step}
          onSubmit={(e) => {
            e.preventDefault();
            submitCode(code);
          }}
        >
          {channel === "email" ? (
            <p className={styles.question} id="auth-code-for">
              {copy.codeSent}{" "}
              <bdi dir="ltr" className={styles.email}>
                {email.trim()}
              </bdi>
            </p>
          ) : (
            <p className={styles.question} id="auth-code-for">
              {channel === "app" ? copy.codeApp : copy.codePhone}
            </p>
          )}
          {/* Two names for one shake, so each wrong code plays it again without remounting the field. */}
          <div className={styles.shake} data-shake={shake ? (shake % 2 ? "a" : "b") : undefined}>
            <CodeField
              inputRef={field}
              label={copy.codeLabel}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (error) setError(null);
              }}
              onComplete={submitCode}
              invalid={Boolean(error)}
              disabled={busy}
              describedBy={["auth-code-for", errorId].filter(Boolean).join(" ")}
            />
          </div>
          {channel === "email" ? <p className={styles.hint}>{copy.codeHint}</p> : null}
          {errorLine}
          {submit(copy.continue)}
          <div className={styles.links}>
            {resendable ? (
              <button
                type="button"
                className={styles.textButton}
                disabled={busy || wait > 0}
                onClick={resend}
              >
                {wait > 0
                  ? fill(copy.resendIn, { s: `0:${String(wait).padStart(2, "0")}` })
                  : copy.resend}
              </button>
            ) : null}
            {canSwitch ? (
              <button
                type="button"
                className={styles.textButton}
                disabled={busy}
                onClick={() => act(() => backend.switchMethod("password"))}
              >
                {copy.usePassword}
              </button>
            ) : null}
            <button type="button" className={styles.textButton} onClick={changeEmail}>
              {copy.changeEmail}
            </button>
          </div>
          <p className={styles.notice} role="status">
            {notice}
          </p>
        </form>
      ) : null}

      {step === "done" ? (
        <div className={styles.done} role="status">
          <span className={styles.doneMark} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30">
              <path
                d="m5 12.5 4.5 4.5L19 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p>{copy.done}</p>
        </div>
      ) : null}

      {kind === "sign-up" ? <div id="clerk-captcha" className={styles.captcha} /> : null}

      {other && step === "email" ? (
        <p className={styles.other}>
          {kind === "sign-in" ? copy.noAccount : copy.haveAccount}{" "}
          <Link href={other}>{kind === "sign-in" ? copy.toSignUp : copy.toSignIn}</Link>
        </p>
      ) : null}
    </div>
  );
}

function errorKey(error: Exclude<AuthError, "signedIn">, kind: string, other?: string | null) {
  // Without a sign-up (the admin), "not yet" would promise one.
  if (error === "notFound" && kind === "sign-in" && !other) return "errNotFoundAdmin" as const;
  return ERROR_KEY[error];
}

/** The email this step is for, with a way back to change it. */
function Who({ email, change, onChange }: { email: string; change: string; onChange: () => void }) {
  return (
    <p className={styles.who}>
      <bdi dir="ltr" className={styles.email}>
        {email.trim()}
      </bdi>
      <button type="button" className={styles.textButton} onClick={onChange}>
        {change}
      </button>
    </p>
  );
}
