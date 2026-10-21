"use client";

import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
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
  /** The server saw a Clerk session on this request: show the welcome from the first paint. */
  signedIn?: boolean;
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

/** How long after one forward to the app another counts as a loop (the app sent them back). */
const FORWARD_GAP_MS = 20_000;
const FORWARDED = "darb-auth-forwarded";

/**
 * Already signed in when this page opens: the app's server can miss a session made a moment ago
 * (Safari, private browsing) and send the person back here, where the form asked for the email
 * again. Clerk knows the session, so go on to the app; only once per FORWARD_GAP_MS, so an app
 * that keeps refusing the session leaves the form here instead of bouncing between the two.
 */
/** Whether a forward now would be the second within FORWARD_GAP_MS (the app sent them back). */
function forwardedLately(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(FORWARDED) ?? 0) < FORWARD_GAP_MS;
  } catch {
    return false;
  }
}

function forward(target: string) {
  try {
    sessionStorage.setItem(FORWARDED, String(Date.now()));
  } catch {
    // Storage blocked: forward anyway; at worst the person signs in by hand.
  }
  finishing = true;
  go(target);
}

/**
 * The welcome instead of the form while this page is finishing, or while it is about to forward a
 * person who is already signed in. Until Clerk loads, the server's view decides, so a signed-in
 * person never sees the form flash before the app.
 */
function useWelcome(target: string, serverSignedIn: boolean) {
  const { isLoaded, isSignedIn } = useAuth();
  const signedIn = isLoaded ? Boolean(isSignedIn) : serverSignedIn;
  const [lately] = useState(() => typeof window !== "undefined" && forwardedLately());
  useEffect(() => {
    if (isLoaded && isSignedIn && !finishing && !lately) forward(target);
  }, [isLoaded, isSignedIn, lately, target]);
  return signedIn && (finishing || !lately);
}

/** Darb's sign-in on Clerk's sign-in resource. */
export function ClerkSignIn({ locale, target, other, initialEmail, signedIn = false }: Props) {
  const { signIn } = useSignIn();
  // The signal's signIn is a stable proxy over Clerk's live attempt.
  const backend = useMemo(() => finishOnce(signInBackend(signIn, target, go)), [signIn, target]);
  const welcome = useWelcome(target, signedIn);
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
export function ClerkSignUp({ locale, target, other, initialEmail, signedIn = false }: Props) {
  const { signUp } = useSignUp();
  const backend = useMemo(() => finishOnce(signUpBackend(signUp, target, go)), [signUp, target]);
  const welcome = useWelcome(target, signedIn);
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
