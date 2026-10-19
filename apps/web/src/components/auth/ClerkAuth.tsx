"use client";

import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { Locale } from "@darb/core";
import { authMessages } from "./auth-copy";
import { AuthFlow } from "./AuthFlow";
import { signInBackend, signUpBackend, type Go } from "./backend";

type Props = {
  locale: Locale;
  /** Where a signed-in person lands (the app's home). */
  target: string;
  /** The other flow's page; none means no sign-up from here. */
  other?: string | null;
  initialEmail?: string;
};

/** Clerk's decorated URL may be absolute (Safari's cookie refresh); then the page loads it. */
function useGo(): Go {
  const router = useRouter();
  return (url) => {
    if (/^https?:/i.test(url)) window.location.assign(url);
    else router.push(url);
  };
}

/** Darb's sign-in on Clerk's sign-in resource. */
export function ClerkSignIn({ locale, target, other, initialEmail }: Props) {
  const { signIn } = useSignIn();
  const go = useGo();
  const router = useRouter();
  // The signal's signIn is a stable proxy over Clerk's live attempt.
  const backend = useMemo(() => signInBackend(signIn, target, go), [signIn, target]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthFlow
      kind="sign-in"
      backend={backend}
      copy={authMessages(locale)}
      other={other}
      initialEmail={initialEmail}
      onSignedIn={() => router.replace(target)}
    />
  );
}

/** Darb's sign-up on Clerk's sign-up resource. */
export function ClerkSignUp({ locale, target, other, initialEmail }: Props) {
  const { signUp } = useSignUp();
  const go = useGo();
  const router = useRouter();
  const backend = useMemo(() => signUpBackend(signUp, target, go), [signUp, target]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthFlow
      kind="sign-up"
      backend={backend}
      copy={authMessages(locale)}
      other={other}
      initialEmail={initialEmail}
      onSignedIn={() => router.replace(target)}
    />
  );
}
