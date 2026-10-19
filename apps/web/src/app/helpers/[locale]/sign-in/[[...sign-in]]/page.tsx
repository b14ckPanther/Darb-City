import { SignIn } from "@clerk/nextjs";
import { notFound } from "next/navigation";
import { adminAuthMode } from "@/admin/mode";
import { fakeHelperSignIn } from "@/helpers/actions";
import { ht } from "@/helpers/copy";
import { HelperShell } from "@/helpers/HelperShell";
import { CLERK_LTR_FIELDS } from "@/helpers/clerk";
import { helperHref } from "@/helpers/routes";
import { isLocale } from "@/lib/locale";
import admin from "@/admin/admin.module.css";
import styles from "@/helpers/helpers.module.css";

/** Sign in to the helper app (the same Clerk app as the admin); a new person signs up from here. */
export default async function HelperSignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const mode = adminAuthMode();
  return (
    <HelperShell locale={locale}>
      <h1 className={styles.title}>{ht(locale, "signInTitle")}</h1>
      <p className={styles.lead}>{ht(locale, "signInLead")}</p>
      {mode === "clerk" ? (
        <SignIn
          routing="path"
          path={helperHref(locale, "/sign-in")}
          signUpUrl={helperHref(locale, "/sign-up")}
          forceRedirectUrl={helperHref(locale)}
          signUpForceRedirectUrl={helperHref(locale)}
          appearance={CLERK_LTR_FIELDS}
        />
      ) : mode === "fake" ? (
        <form action={fakeHelperSignIn} className={styles.state}>
          <input type="hidden" name="locale" value={locale} />
          <label className={admin.field}>
            <span>{ht(locale, "fakeUser")}</span>
            <input name="user" defaultValue="user_helper_e2e" required dir="ltr" />
          </label>
          <label className={admin.field}>
            <span>{ht(locale, "fakeEmail")}</span>
            <input name="email" type="email" defaultValue="helper@darb.test" required dir="ltr" />
          </label>
          <button className={styles.primary} type="submit">
            {ht(locale, "signIn")}
          </button>
        </form>
      ) : (
        <p className={styles.muted}>{ht(locale, "notConfigured")}</p>
      )}
    </HelperShell>
  );
}
