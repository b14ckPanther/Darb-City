"use client";

import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { useMemo } from "react";
import type { Locale } from "@darb/core";
import { authMessages } from "./auth-copy";
import { AuthFlow } from "./AuthFlow";
import { signInBackend, signUpBackend, type AuthBackend, type Go } from "./backend";

type Props = {
  locale: Locale;
  /** Where a signed-in person lands (the app's home). */
  target: string;
  /** The other flow's page; none means no sign-up from here. */
  other?: string | null;
  initialEmail?: string;
};

/**
 * A full page load, never a client navigation: the app's home was rendered (and cached by the
 * router) while signed out as a redirect to this page, so a soft push lands right back here. The
 * load also carries the fresh session cookie to the server on its first request.
 */
const go: Go = (url) => window.location.assign(url);

/**
 * Set when this page starts finishing a sign-in. Turning the session on makes Clerk redraw the page
 * before the browser leaves it, which started the form over at the email; a module flag outlives
 * that redraw, so the flow keeps its welcome until the app loads.
 */
let finishing = false;
const finishOnce = (backend: AuthBackend): AuthBackend => ({
  ...backend,
  finish() {
    finishing = true;
    return backend.finish();
  },
});

function useWelcome() {
  const { isSignedIn } = useAuth();
  return Boolean(isSignedIn) && finishing;
}

/** Darb's sign-in on Clerk's sign-in resource. */
export function ClerkSignIn({ locale, target, other, initialEmail }: Props) {
  const { signIn } = useSignIn();
  // The signal's signIn is a stable proxy over Clerk's live attempt.
  const backend = useMemo(() => finishOnce(signInBackend(signIn, target, go)), [signIn, target]);
  const welcome = useWelcome();
  return (
    <AuthFlow
      kind="sign-in"
      backend={backend}
      copy={authMessages(locale)}
      other={other}
      initialEmail={initialEmail}
      signedIn={welcome}
      onSignedIn={() => window.location.replace(target)}
    />
  );
}

/** Darb's sign-up on Clerk's sign-up resource. */
export function ClerkSignUp({ locale, target, other, initialEmail }: Props) {
  const { signUp } = useSignUp();
  const backend = useMemo(() => finishOnce(signUpBackend(signUp, target, go)), [signUp, target]);
  const welcome = useWelcome();
  return (
    <AuthFlow
      kind="sign-up"
      backend={backend}
      copy={authMessages(locale)}
      other={other}
      initialEmail={initialEmail}
      signedIn={welcome}
      onSignedIn={() => window.location.replace(target)}
    />
  );
}
