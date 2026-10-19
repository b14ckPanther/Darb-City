import { SignUp } from "@clerk/nextjs";
import { notFound, redirect } from "next/navigation";
import { adminAuthMode } from "@/admin/mode";
import { ht } from "@/helpers/copy";
import { HelperShell } from "@/helpers/HelperShell";
import { CLERK_LTR_FIELDS } from "@/helpers/clerk";
import { helperHref } from "@/helpers/routes";
import { isLocale } from "@/lib/locale";
import styles from "@/helpers/helpers.module.css";

/** Anyone may sign up; the apply form and an admin's approval come after. */
export default async function HelperSignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (adminAuthMode() !== "clerk") redirect(helperHref(locale, "/sign-in"));
  return (
    <HelperShell locale={locale}>
      <h1 className={styles.title}>{ht(locale, "signUpTitle")}</h1>
      <p className={styles.lead}>{ht(locale, "signInLead")}</p>
      <SignUp
        routing="path"
        path={helperHref(locale, "/sign-up")}
        signInUrl={helperHref(locale, "/sign-in")}
        forceRedirectUrl={helperHref(locale)}
        signInForceRedirectUrl={helperHref(locale)}
        appearance={CLERK_LTR_FIELDS}
      />
    </HelperShell>
  );
}
