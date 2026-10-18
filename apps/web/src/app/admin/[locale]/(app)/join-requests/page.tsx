import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminJoinPageDto, AdminJoinRequestDto } from "@darb/contracts";
import { pickText, type Locale } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { at, type AdminKey } from "@/admin/copy";
import { one, withParams, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Pager } from "@/admin/Toolbar";
import { isLocale } from "@/lib/locale";
import { JOIN_STATUS_KEY, joinSourceKey, receivedAt, telHref } from "@/admin/join-view";
import { mediaUrl } from "@/lib/card";
import styles from "@/admin/admin.module.css";

function Request({ locale, item }: { locale: Locale; item: AdminJoinRequestDto }) {
  const waiting = item.status === "pending";
  const street = item.source === "field";
  return (
    <article
      className={waiting ? `${styles.card} ${styles.inquiry} ${styles.inquiryNew}` : styles.card}
      aria-labelledby={`join-${item.id}`}
    >
      <header className={styles.inquiryHead}>
        <h2 id={`join-${item.id}`} className={styles.h2}>
          <Link href={adminHref(locale, `/join-requests/${item.id}`)}>
            <bdi>{pickText(item.businessName, locale)}</bdi>
          </Link>
        </h2>
        <span className={waiting ? `${styles.badge} ${styles.badgeGold}` : styles.badge}>
          {at(locale, JOIN_STATUS_KEY[item.status])}
        </span>
        {street ? <span className={styles.badge}>{at(locale, "streetBadge")}</span> : null}
        <time dateTime={item.createdAt} className={styles.hint}>
          {at(locale, "inquiryReceived")}: {receivedAt(locale, item.createdAt)}
        </time>
      </header>
      {street && item.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- an admin thumbnail straight from the bucket
        <img
          src={mediaUrl(item.photo)}
          alt={at(locale, "streetPhotoAlt")}
          className={styles.thumb}
          loading="lazy"
        />
      ) : null}
      <dl className={styles.facts}>
        {street ? null : (
          <>
            <dt>{at(locale, "joinOwner")}</dt>
            <dd>
              <bdi>{item.ownerName}</bdi>
            </dd>
            <dt>{at(locale, "joinOwnerPhone")}</dt>
            <dd>
              <a href={telHref(item.ownerPhone)} dir="ltr">
                {item.ownerPhone}
              </a>
            </dd>
          </>
        )}
        {item.placeSlug ? (
          <>
            <dt>{at(locale, "fieldPlace")}</dt>
            <dd dir="ltr">{item.placeSlug}</dd>
          </>
        ) : null}
        {/* A street capture says so in its badge. */}
        {street ? null : (
          <>
            <dt>{at(locale, "joinSource")}</dt>
            <dd>{at(locale, joinSourceKey(item.source))}</dd>
          </>
        )}
      </dl>
      <Link
        className={waiting ? styles.primary : styles.ghost}
        href={adminHref(locale, `/join-requests/${item.id}`)}
      >
        {at(locale, "joinOpen")}
      </Link>
    </article>
  );
}

/** The /join queue: waiting requests first, then the decided ones, newest first. */
export default async function JoinRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const raw = one(sp.status);
  const status = raw === "pending" || raw === "approved" || raw === "rejected" ? raw : undefined;
  const page = okOr<AdminJoinPageDto>(
    await (await adminApi()).joinRequests.list({ query: { status, cursor: one(sp.cursor) } }),
    locale,
  );
  const base = adminHref(locale, "/join-requests");
  const filters: [string | undefined, AdminKey][] = [
    [undefined, "all"],
    ["pending", "joinPending"],
    ["approved", "joinApproved"],
    ["rejected", "joinRejected"],
  ];
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{at(locale, "navJoin")}</h1>
        {page.newCount > 0 ? (
          <span className={`${styles.badge} ${styles.badgeGold}`}>
            {at(locale, "joinPendingCount", { count: page.newCount })}
          </span>
        ) : null}
      </div>
      <p className={styles.hint}>{at(locale, "joinHint")}</p>
      <nav className={styles.actions} aria-label={at(locale, "status")}>
        {filters.map(([value, key]) => (
          <Link
            key={key}
            href={withParams(base, { status: value })}
            className={styles.ghost}
            aria-current={status === value ? "page" : undefined}
          >
            {at(locale, key)}
          </Link>
        ))}
      </nav>
      {page.items.length === 0 ? (
        <p>{at(locale, "empty")}</p>
      ) : (
        page.items.map((item) => <Request key={item.id} locale={locale} item={item} />)
      )}
      <Pager
        locale={locale}
        href={page.nextCursor ? withParams(base, { status, cursor: page.nextCursor }) : null}
      />
    </>
  );
}
