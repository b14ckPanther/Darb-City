import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";
import type { FieldCaptureDto } from "@darb/contracts";
import { pickText, type Locale } from "@darb/core";
import { receivedAt } from "@/admin/join-view";
import { canAdd, canReadOwn, helperApi, helperOrSignIn } from "@/helpers/api";
import { ht, type HelperKey } from "@/helpers/copy";
import { HelperShell } from "@/helpers/HelperShell";
import { helperHref } from "@/helpers/routes";
import { isLocale } from "@/lib/locale";
import { href, paths } from "@/lib/routes";
import styles from "@/helpers/helpers.module.css";
import d from "@/helpers/delight.module.css";

/** A number that counts up from 0 as the screen opens (CSS only; still with reduced motion). */
function Count({ value }: { value: number }) {
  return (
    <strong className={d.count} style={{ "--to": value } as CSSProperties} data-count={value}>
      <span>{value}</span>
    </strong>
  );
}

const STATE: Record<"pending" | "live" | "rejected" | "approved", HelperKey> = {
  pending: "mineWaiting",
  live: "mineLive",
  approved: "mineLive",
  rejected: "mineNotAdded",
};

/** Live ones get a gold light passing over them, one after another (the first few only). */
const SHINE_MAX = 8;

function Addition({
  locale,
  item,
  shine,
}: {
  locale: Locale;
  item: FieldCaptureDto;
  /** Its place among the live ones on screen, for the shine's order; null when not shown. */
  shine: number | null;
}) {
  const state = item.live ? "live" : item.status;
  return (
    <li className={styles.item} data-addition={item.id}>
      <div className={styles.itemHead}>
        <bdi className={styles.itemName}>{pickText(item.businessName, locale)}</bdi>
        <span
          className={shine === null ? styles.pill : `${styles.pill} ${d.shine}`}
          data-state={state}
          style={shine === null ? undefined : ({ "--i": shine } as CSSProperties)}
        >
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
  // How many live ones are drawn so far: the shine passes over them in order.
  let shown = 0;
  return (
    <HelperShell locale={locale} tab="mine" tabs>
      <h1 className={styles.title}>{ht(locale, "mineTitle")}</h1>
      <div className={styles.stats} data-summary="">
        <p className={styles.srOnly}>
          {ht(locale, "mineSummary", { total: mine.total, live: mine.live })}
        </p>
        <div aria-hidden="true">
          <Count value={mine.total} />
          <span>{ht(locale, "mineAdded")}</span>
        </div>
        <div aria-hidden="true" data-live="" className={mine.live > 0 ? d.shine : undefined}>
          <Count value={mine.live} />
          <span>{ht(locale, "mineLiveCount")}</span>
        </div>
        <div aria-hidden="true">
          <Count value={mine.today} />
          <span>{ht(locale, "mineTodayCount")}</span>
        </div>
      </div>
      {mine.items.length === 0 ? (
        <section className={styles.empty}>
          <span className={styles.stateIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30">
              <path
                d="M12 21s-7-6.4-7-11.5a7 7 0 0 1 14 0C19 14.6 12 21 12 21Zm0-14.5v6m-3-3h6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className={styles.muted}>{ht(locale, "mineEmpty")}</p>
          {canAdd(session.me) ? (
            <a
              href={helperHref(locale, "?camera=1")}
              className={`${styles.primary} ${styles.wide}`}
            >
              {ht(locale, "mineEmptyAction")}
            </a>
          ) : null}
        </section>
      ) : (
        <ul className={styles.list} role="list" aria-label={ht(locale, "mineTitle")}>
          {mine.items.map((item) => {
            const order = item.live ? shown++ : null;
            return (
              <Addition
                key={item.id}
                locale={locale}
                item={item}
                shine={order !== null && order < SHINE_MAX ? order + 1 : null}
              />
            );
          })}
        </ul>
      )}
    </HelperShell>
  );
}
