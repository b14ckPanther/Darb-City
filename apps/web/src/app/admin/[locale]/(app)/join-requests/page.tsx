import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminJoinPageDto, AdminJoinRequestDto } from "@darb/contracts";
import { pickText, type Locale } from "@darb/core";
import { ActionButton } from "@/admin/ActionButton";
import { approveHelperJoins } from "@/admin/join-actions";
import { AdminIcon } from "@/admin/AdminIcon";
import { adminApi, okOr } from "@/admin/api";
import { at, type AdminKey } from "@/admin/copy";
import { one, withParams, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Pager } from "@/admin/Toolbar";
import { isLocale } from "@/lib/locale";
import { telHref } from "@/admin/join-view";
import { Empty, Monogram, PageHead, relativeTime, Status, StatusTabs } from "@/admin/ui";
import { mediaUrl } from "@/lib/card";
import styles from "@/admin/admin.module.css";
import j from "@/admin/queue.module.css";

function Request({ locale, item }: { locale: Locale; item: AdminJoinRequestDto }) {
  const street = item.source === "field";
  const name = pickText(item.businessName, locale);
  const href = adminHref(locale, `/join-requests/${item.id}`);
  return (
    <li
      className={j.row}
      data-waiting={item.status === "pending" ? "" : undefined}
      data-row={item.id}
    >
      {item.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- an admin thumbnail straight from the bucket
        <img
          src={mediaUrl(item.photo)}
          alt={street ? at(locale, "streetPhotoAlt") : ""}
          className={j.photo}
          loading="lazy"
        />
      ) : (
        <Monogram name={name} locale={locale} />
      )}
      <div className={j.text}>
        <Link href={href} className={styles.rowLink}>
          <bdi>{name}</bdi>
        </Link>
        <span className={styles.secondary}>
          {[
            item.placeName ? pickText(item.placeName, locale) : item.placeSlug,
            item.helper
              ? `${at(locale, "helperFrom")} · ${item.helper.name || at(locale, "helperNoName")}`
              : street
                ? at(locale, "streetBadge")
                : item.ownerName,
            relativeTime(locale, item.createdAt),
          ]
            .filter(Boolean)
            .map((part, i) => (
              <span key={i}>
                {i ? " · " : ""}
                <bdi>{part}</bdi>
              </span>
            ))}
        </span>
      </div>
      {street ? null : (
        <a href={telHref(item.ownerPhone)} dir="ltr" className={j.phone}>
          {item.ownerPhone}
        </a>
      )}
      <Status locale={locale} status={item.status} />
      <AdminIcon name="chevron" size={16} className={j.chev} />
    </li>
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
  // One helper's additions, from the Helpers screen.
  const helper = /^[0-9a-f-]{36}$/i.test(one(sp.helper) ?? "") ? one(sp.helper) : undefined;
  const page = okOr<AdminJoinPageDto>(
    await (
      await adminApi()
    ).joinRequests.list({ query: { status, helper, cursor: one(sp.cursor) } }),
    locale,
  );
  const base = adminHref(locale, "/join-requests");
  const helperName = helper ? page.items.find((i) => i.helper)?.helper?.name : undefined;
  const filters: [string | undefined, AdminKey][] = [
    [undefined, "all"],
    ["pending", "joinPending"],
    ["approved", "joinApproved"],
    ["rejected", "joinRejected"],
  ];
  return (
    <div className={styles.narrow}>
      <PageHead
        title={at(locale, "navJoin")}
        sub={
          helper
            ? at(locale, "helperAdditionsBy", { name: helperName || at(locale, "helperNoName") })
            : at(locale, "joinHint")
        }
        actions={
          <>
            {helper && page.helperPending ? (
              // One helper's waiting additions, all at once (each audited as a single approval).
              <ActionButton
                action={approveHelperJoins}
                fields={{ helper, locale }}
                label={at(locale, "joinApproveAll", { count: page.helperPending })}
                className={styles.primary}
                icon={<AdminIcon name="check" size={18} />}
                celebrate
                confirm={at(locale, "joinApproveAllConfirm", {
                  count: page.helperPending,
                  name: helperName || at(locale, "helperNoName"),
                })}
              />
            ) : null}
            <Link href={adminHref(locale, "/field")} className={styles.ghost}>
              <AdminIcon name="camera" size={18} />
              {at(locale, "navStreet")}
            </Link>
          </>
        }
      />
      <StatusTabs
        label={at(locale, "status")}
        tabs={filters.map(([value, key]) => ({
          href: withParams(base, { status: value, helper }),
          label: at(locale, key),
          current: status === value,
          count: value === "pending" ? page.newCount : undefined,
        }))}
      />
      {page.items.length === 0 ? (
        <div className={styles.tableWrap}>
          <Empty icon="inbox" title={at(locale, "joinEmpty")} />
        </div>
      ) : (
        <ul className={j.list} role="list" data-list="join-requests">
          {page.items.map((item) => (
            <Request key={item.id} locale={locale} item={item} />
          ))}
        </ul>
      )}
      <Pager
        locale={locale}
        href={
          page.nextCursor ? withParams(base, { status, helper, cursor: page.nextCursor }) : null
        }
      />
    </div>
  );
}
