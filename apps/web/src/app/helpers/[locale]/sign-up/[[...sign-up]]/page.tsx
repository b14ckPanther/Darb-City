import { notFound, redirect } from "next/navigation";
import { adminAuthMode } from "@/admin/mode";
import { ClerkSignUp } from "@/components/auth/ClerkAuth";
import { HelperAuth } from "@/helpers/HelperAuth";
import { helperHref } from "@/helpers/routes";
import { isLocale } from "@/lib/locale";

/** Anyone may sign up; the apply form and an admin's approval come after. */
export default async function HelperSignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (adminAuthMode() !== "clerk") redirect(helperHref(locale, "/sign-in"));
  const { email } = await searchParams;
  return (
    <HelperAuth locale={locale} title="signUpTitle">
      <ClerkSignUp
        locale={locale}
        target={helperHref(locale)}
        other={helperHref(locale, "/sign-in")}
        initialEmail={typeof email === "string" ? email : ""}
      />
    </HelperAuth>
  );
}
