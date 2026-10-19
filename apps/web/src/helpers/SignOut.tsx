"use client";

import { SignOutButton } from "@clerk/nextjs";
import type { Locale } from "@darb/core";
import { helperHref } from "./routes";

export function ClerkHelperSignOut({
  locale,
  label,
  className,
}: {
  locale: Locale;
  label: string;
  className?: string;
}) {
  return (
    <SignOutButton redirectUrl={helperHref(locale, "/sign-in")}>
      <button className={className} type="button">
        {label}
      </button>
    </SignOutButton>
  );
}
