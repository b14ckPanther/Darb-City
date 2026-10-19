"use client";

import { SignOutButton } from "@clerk/nextjs";
import type { Locale } from "@darb/core";
import { AdminIcon } from "./AdminIcon";
import { adminHintCookie } from "./marker";
import { adminHref } from "./routes";
import styles from "./shell.module.css";

export function ClerkSignOut({
  locale,
  label,
  className,
}: {
  locale: Locale;
  label: string;
  className?: string;
}) {
  return (
    <SignOutButton redirectUrl={adminHref(locale, "/sign-in")}>
      <button
        className={className}
        type="button"
        title={label}
        // The public site stops offering Edit in this browser.
        onClick={() => (document.cookie = adminHintCookie(location.protocol === "https:", false))}
      >
        <AdminIcon name="signOut" />
        <span className={styles.sideLabel}>{label}</span>
      </button>
    </SignOutButton>
  );
}
