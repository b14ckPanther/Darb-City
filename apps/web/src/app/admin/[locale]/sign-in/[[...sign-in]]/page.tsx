import { notFound } from "next/navigation";
import { at } from "@/admin/copy";
import { adminAuthMode } from "@/admin/mode";
import { adminHref } from "@/admin/routes";
import { fakeSignIn } from "@/admin/session-actions";
import { AuthStage, authStyles } from "@/components/auth/AuthStage";
import { ClerkSignIn } from "@/components/auth/ClerkAuth";
import { isLocale } from "@/lib/locale";

/** Darb's own sign-in for the admin: sign-in only (accounts are made by the founder). */
export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { email } = await searchParams;
  const mode = adminAuthMode();
  return (
    <AuthStage
      eyebrow={at(locale, "title")}
      title={at(locale, "signInTitle")}
      lead={at(locale, "signInLead")}
    >
      {mode === "clerk" ? (
        <ClerkSignIn
          locale={locale}
          target={adminHref(locale)}
          initialEmail={typeof email === "string" ? email : ""}
        />
      ) : mode === "fake" ? (
        <form action={fakeSignIn} className={authStyles.fakeForm}>
          <input type="hidden" name="locale" value={locale} />
          <label className={authStyles.label}>
            <span>{at(locale, "fakeUser")}</span>
            <input
              className={authStyles.input}
              name="user"
              defaultValue="user_e2e"
              required
              dir="ltr"
            />
          </label>
          <label className={authStyles.label}>
            <span>Email</span>
            <input
              className={authStyles.input}
              name="email"
              type="email"
              defaultValue="e2e-admin@darb.test"
              required
              dir="ltr"
            />
          </label>
          <button className={authStyles.submit} type="submit">
            {at(locale, "signIn")}
          </button>
        </form>
      ) : (
        <p className={authStyles.note}>{at(locale, "notConfigured")}</p>
      )}
    </AuthStage>
  );
}
