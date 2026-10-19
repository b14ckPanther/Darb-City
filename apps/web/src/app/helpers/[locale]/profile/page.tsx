import { notFound, redirect } from "next/navigation";
import { pickText } from "@darb/core";
import { canReadOwn, helperOrSignIn } from "@/helpers/api";
import { ht, type HelperKey } from "@/helpers/copy";
import { HelperShell, HelperSignOut } from "@/helpers/HelperShell";
import { ProfileForm } from "@/helpers/ProfileForm";
import { helperHref } from "@/helpers/routes";
import { isLocale } from "@/lib/locale";
import styles from "@/helpers/helpers.module.css";

const STATUS: Record<string, HelperKey> = {
  none: "statusNone",
  pending: "statusPending",
  approved: "statusApproved",
  paused: "statusPaused",
};

/** The helper's display name, the public credit toggle (off by default), and sign out. */
export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await helperOrSignIn(locale);
  if (session.status !== "ok") redirect(helperHref(locale));
  const me = session.me;
  // Only someone who applied (or an admin) has a helper profile to edit.
  if (me.status === "none" && !me.isAdmin) redirect(helperHref(locale));
  return (
    <HelperShell locale={locale} tab="profile" tabs={canReadOwn(me)}>
      <h1 className={styles.title}>{ht(locale, "profileTitle")}</h1>
      <dl className={styles.facts}>
        <dt>{ht(locale, "profileStatus")}</dt>
        <dd>{ht(locale, STATUS[me.status] ?? "statusNone")}</dd>
        {me.placeName ? (
          <>
            <dt>{ht(locale, "profileTown")}</dt>
            <dd>{pickText(me.placeName, locale)}</dd>
          </>
        ) : null}
      </dl>
      {me.isAdmin && me.status === "none" ? (
        <p className={styles.lead}>{ht(locale, "adminNote")}</p>
      ) : null}
      <ProfileForm locale={locale} name={me.name ?? ""} credit={me.credit} />
      <div className={styles.row}>
        <HelperSignOut locale={locale} className={styles.ghost} />
      </div>
    </HelperShell>
  );
}
