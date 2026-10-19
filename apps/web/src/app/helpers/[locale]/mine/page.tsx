import { notFound, redirect } from "next/navigation";
import type { FieldCaptureDto } from "@darb/contracts";
import { pickText, type Locale } from "@darb/core";
import { receivedAt } from "@/admin/join-view";
import { canReadOwn, helperApi, helperOrSignIn } from "@/helpers/api";
import { ht, type HelperKey } from "@/helpers/copy";
import { HelperShell } from "@/helpers/HelperShell";
import { helperHref } from "@/helpers/routes";
import { isLocale } from "@/lib/locale";
import { href, paths } from "@/lib/routes";
import styles from "@/helpers/helpers.module.css";

const STATE: Record<"pending" | "live" | "rejected" | "approved", HelperKey> = {
  pending: "mineWaiting",
  live: "mineLive",
  approved: "mineLive",
  rejected: "mineNotAdded",
};

function Addition({ locale, item }: { locale: Locale; item: FieldCaptureDto }) {
  const state = item.live ? "live" : item.status;
  return (
    <li className={styles.item} data-addition={item.id}>
      <div className={styles.itemHead}>
        <bdi className={styles.itemName}>{pickText(item.businessName, locale)}</bdi>
        <span className={styles.pill} data-state={state}>
          {ht(locale, STATE[state])}
        </span>
      </div>
      <time dateTime={item.createdAt} className={styles.muted}>
        {receivedAt(locale, item.createdAt)}
      </time>
      {item.status === "rejected" && item.rejectReason ? (
        <p className={styles.muted} dir="auto">
          {ht(locale, "mineReason", { reason: item.rejectReason })}
        </p>
      ) : null}
      {item.live ? (
        <a
          href={href(
            locale,
            paths.business(item.live.place, item.live.sector, item.live.kind, item.live.business),
          )}
          target="_blank"
          rel="noopener"
        >
          {ht(locale, "mineOpen")}
        </a>
      ) : null}
    </li>
  );
}

/** "You added 23 · 18 live": the helper's own additions (only theirs), newest first. */
export default async function MinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await helperOrSignIn(locale);
  if (session.status !== "ok" || !canReadOwn(session.me)) redirect(helperHref(locale));
  const res = await (await helperApi()).field.mine();
  if (res.status === 401) redirect(helperHref(locale, "/sign-in"));
  if (res.status !== 200) redirect(helperHref(locale));
  const mine = res.body;
  return (
    <HelperShell locale={locale} tab="mine" tabs>
      <h1 className={styles.title}>{ht(locale, "mineTitle")}</h1>
      <p className={styles.summary} data-summary="">
        {ht(locale, "mineSummary", { total: mine.total, live: mine.live })}
      </p>
      {mine.items.length === 0 ? (
        <p className={styles.muted}>{ht(locale, "mineEmpty")}</p>
      ) : (
        <ul className={styles.list} role="list" aria-label={ht(locale, "mineTitle")}>
          {mine.items.map((item) => (
            <Addition key={item.id} locale={locale} item={item} />
          ))}
        </ul>
      )}
    </HelperShell>
  );
}
