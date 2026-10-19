import { SignIn } from "@clerk/nextjs";
import { notFound } from "next/navigation";
import { at } from "@/admin/copy";
import { adminAuthMode } from "@/admin/mode";
import { adminHref } from "@/admin/routes";
import { fakeSignIn } from "@/admin/session-actions";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

/** Emails, passwords and codes read left to right, also in the Hebrew and Arabic sign-in. */
const LTR_FIELDS = {
  elements: {
    formFieldInput: { direction: "ltr" },
    // The code row itself runs left to right: in an RTL page the first digit lands on the right
    // and typing moves leftward unless the boxes' container is LTR too.
    otpCodeField: { direction: "ltr" },
    otpCodeFieldInputs: { direction: "ltr" },
    otpCodeFieldInputContainer: { direction: "ltr" },
    otpCodeFieldInput: { direction: "ltr" },
    identityPreviewText: { direction: "ltr" },
  },
} as const;

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const mode = adminAuthMode();
  return (
    <main className={styles.center}>
      <h1 className={styles.brand}>{at(locale, "signInTitle")}</h1>
      {mode === "clerk" ? (
        <SignIn
          routing="path"
          path={adminHref(locale, "/sign-in")}
          forceRedirectUrl={adminHref(locale)}
          appearance={LTR_FIELDS}
        />
      ) : mode === "fake" ? (
        <form action={fakeSignIn} className={styles.card}>
          <input type="hidden" name="locale" value={locale} />
          <label className={styles.field}>
            <span>{at(locale, "fakeUser")}</span>
            <input name="user" defaultValue="user_e2e" required />
          </label>
          <label className={styles.field}>
            <span>Email</span>
            <input
              name="email"
              type="email"
              defaultValue="e2e-admin@darb.test"
              required
              dir="ltr"
            />
          </label>
          <button className={styles.primary} type="submit">
            {at(locale, "signIn")}
          </button>
        </form>
      ) : (
        <p className={styles.notice}>{at(locale, "notConfigured")}</p>
      )}
    </main>
  );
}
