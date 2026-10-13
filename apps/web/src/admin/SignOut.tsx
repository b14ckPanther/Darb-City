"use client";

import { SignOutButton } from "@clerk/nextjs";
import type { Locale } from "@darb/core";
import { adminHref } from "./routes";
import styles from "./admin.module.css";

export function ClerkSignOut({ locale, label }: { locale: Locale; label: string }) {
  return (
    <SignOutButton redirectUrl={adminHref(locale, "/sign-in")}>
      <button className={styles.ghost} type="button">
        {label}
      </button>
    </SignOutButton>
  );
}
