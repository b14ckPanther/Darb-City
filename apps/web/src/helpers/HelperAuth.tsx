import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { adminAuthMode } from "@/admin/mode";
import { AuthStage, authStyles } from "@/components/auth/AuthStage";
import { fakeHelperSignIn } from "./actions";
import { ht, type HelperKey } from "./copy";

const HOW: [HelperKey, HelperKey][] = [
  ["how1", "how1Hint"],
  ["how2", "how2Hint"],
  ["how3", "how3Hint"],
];

/** The helper app's sign-in and sign-up page: the shared stage with the three "how it works" stops. */
export function HelperAuth({
  locale,
  title,
  children,
}: {
  locale: Locale;
  title: HelperKey;
  children: ReactNode;
}) {
  const mode = adminAuthMode();
  return (
    <AuthStage
      eyebrow={ht(locale, "title")}
      title={ht(locale, title)}
      lead={ht(locale, "signInLead")}
      stepsLabel={ht(locale, "howTitle")}
      steps={HOW.map(([t, h]) => ({ title: ht(locale, t), hint: ht(locale, h) }))}
    >
      {mode === "clerk" ? (
        children
      ) : mode === "fake" ? (
        <form action={fakeHelperSignIn} className={authStyles.fakeForm}>
          <input type="hidden" name="locale" value={locale} />
          <label className={authStyles.label}>
            <span>{ht(locale, "fakeUser")}</span>
            <input
              className={authStyles.input}
              name="user"
              defaultValue="user_helper_e2e"
              required
              dir="ltr"
            />
          </label>
          <label className={authStyles.label}>
            <span>{ht(locale, "fakeEmail")}</span>
            <input
              className={authStyles.input}
              name="email"
              type="email"
              defaultValue="helper@darb.test"
              required
              dir="ltr"
            />
          </label>
          <button className={authStyles.submit} type="submit">
            {ht(locale, "signIn")}
          </button>
        </form>
      ) : (
        <p className={authStyles.note}>{ht(locale, "notConfigured")}</p>
      )}
    </AuthStage>
  );
}
