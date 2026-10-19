import { notFound } from "next/navigation";
import { ClerkSignIn } from "@/components/auth/ClerkAuth";
import { HelperAuth } from "@/helpers/HelperAuth";
import { helperHref } from "@/helpers/routes";
import { isLocale } from "@/lib/locale";

/** Sign in to the helper app (the same Clerk app as the admin); a new person signs up from here. */
export default async function HelperSignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { email } = await searchParams;
  return (
    <HelperAuth locale={locale} title="signInTitle">
      <ClerkSignIn
        locale={locale}
        target={helperHref(locale)}
        other={helperHref(locale, "/sign-up")}
        initialEmail={typeof email === "string" ? email : ""}
      />
    </HelperAuth>
  );
}
