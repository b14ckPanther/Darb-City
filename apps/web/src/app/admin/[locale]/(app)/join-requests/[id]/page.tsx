import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminBusinessDto, AdminJoinRequestDto, AdminKindDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { ActionButton } from "@/admin/ActionButton";
import { ActionForm } from "@/admin/ActionForm";
import { adminApi, okOr } from "@/admin/api";
import { BusinessForm } from "@/admin/BusinessForm";
import { at } from "@/admin/copy";
import { TextArea } from "@/admin/fields";
import { approveJoin, rejectJoin } from "@/admin/join-actions";
import { JOIN_STATUS_KEY, joinSourceKey, receivedAt, telHref } from "@/admin/join-view";
import { mediaUrl } from "@/lib/card";
import { adminHref } from "@/admin/routes";
import { getJoinStatus } from "@/lib/api";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

/**
 * One join request: who sent it (private), what the lookup suggested, and the draft business in
 * the normal business form. Approve publishes the saved draft; reject deletes it.
 */
export default async function JoinRequestPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const api = await adminApi();
  const r = okOr<AdminJoinRequestDto>(await api.joinRequests.get({ params: { id } }), locale);
  const [business, kinds, status] = await Promise.all([
    r.businessId
      ? api.businesses
          .get({ params: { id: r.businessId } })
          .then((res) => (res.status === 200 ? (res.body as AdminBusinessDto) : null))
      : Promise.resolve(null),
    api.kinds.list({ query: {} }).then((res) => okOr<AdminKindDto[]>(res, locale)),
    getJoinStatus(),
  ]);
  const s = r.lookup;
  const waiting = r.status === "pending";
  const street = r.source === "field";
  return (
    <>
      <p>
        <Link href={adminHref(locale, "/join-requests")} className={styles.ghost}>
          {at(locale, "navJoin")}
        </Link>
      </p>
      <div className={styles.actions}>
        <h1 className={styles.h1}>
          <bdi>{pickText(r.businessName, locale)}</bdi>
        </h1>
        <span className={waiting ? `${styles.badge} ${styles.badgeGold}` : styles.badge}>
          {at(locale, JOIN_STATUS_KEY[r.status])}
        </span>
        {street ? <span className={styles.badge}>{at(locale, "streetBadge")}</span> : null}
      </div>
      {street ? (
        <section className={styles.card} aria-labelledby="join-sign">
          <h2 id="join-sign" className={styles.h2}>
            {at(locale, "streetSign")}
          </h2>
          <p className={styles.hint}>{at(locale, "streetAddedBy")}</p>
          {r.photo ? (
            <a href={mediaUrl(r.photo)} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- the full photo from the bucket */}
              <img
                src={mediaUrl(r.photo)}
                alt={at(locale, "streetPhotoAlt")}
                className={styles.signPhoto}
              />
            </a>
          ) : null}
          <dl className={styles.facts}>
            <dt>{at(locale, "inquiryReceived")}</dt>
            <dd>{receivedAt(locale, r.createdAt)}</dd>
          </dl>
          {r.note ? (
            <p className={styles.message} dir="auto">
              {r.note}
            </p>
          ) : null}
          {r.rejectReason ? (
            <p className={styles.error}>
              {at(locale, "joinRejectedBecause", { reason: r.rejectReason })}
            </p>
          ) : null}
        </section>
      ) : (
        <section className={styles.card} aria-labelledby="join-owner">
          <h2 id="join-owner" className={styles.h2}>
            {at(locale, "joinOwner")}
          </h2>
          <dl className={styles.facts}>
            <dt>{at(locale, "fieldName")}</dt>
            <dd>
              <bdi>{r.ownerName}</bdi>
            </dd>
            <dt>{at(locale, "joinOwnerPhone")}</dt>
            <dd>
              <a href={telHref(r.ownerPhone)} dir="ltr">
                {r.ownerPhone}
              </a>
            </dd>
            {r.ownerEmail ? (
              <>
                <dt>{at(locale, "joinOwnerEmail")}</dt>
                <dd>
                  <a href={`mailto:${r.ownerEmail}`} dir="ltr">
                    {r.ownerEmail}
                  </a>
                </dd>
              </>
            ) : null}
            <dt>{at(locale, "inquiryLocale")}</dt>
            <dd dir="ltr">{r.locale}</dd>
            <dt>{at(locale, "inquiryReceived")}</dt>
            <dd>{receivedAt(locale, r.createdAt)}</dd>
            <dt>{at(locale, "joinSource")}</dt>
            <dd>{at(locale, joinSourceKey(r.source))}</dd>
          </dl>
          {r.note ? (
            <>
              <h3 className={styles.hint}>{at(locale, "joinNote")}</h3>
              <p className={styles.message} dir="auto">
                {r.note}
              </p>
            </>
          ) : null}
          {r.rejectReason ? (
            <p className={styles.error}>
              {at(locale, "joinRejectedBecause", { reason: r.rejectReason })}
            </p>
          ) : null}
        </section>
      )}
      {s ? (
        <section className={styles.card} aria-labelledby="join-lookup">
          <h2 id="join-lookup" className={styles.h2}>
            {at(locale, "joinSuggested")}
          </h2>
          <pre className={styles.message} dir="ltr">
            {JSON.stringify({ ...s, sources: undefined }, null, 2)}
          </pre>
          {s.sources.length ? (
            <>
              <h3 className={styles.hint}>{at(locale, "joinFoundOn")}</h3>
              <ul>
                {s.sources.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer nofollow" dir="ltr">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}
      {business ? (
        <>
          {waiting ? <p className={styles.notice}>{at(locale, "joinSaveFirst")}</p> : null}
          <BusinessForm
            locale={locale}
            kinds={kinds}
            business={business}
            uploads={status.uploads}
          />
        </>
      ) : (
        <p className={styles.hint}>{at(locale, "joinDraftGone")}</p>
      )}
      {waiting && business ? (
        <>
          <ActionButton
            action={approveJoin}
            fields={{ id: r.id, locale }}
            label={at(locale, "joinApprove")}
            className={styles.primary}
          />
          <ActionForm
            action={rejectJoin}
            submit={at(locale, "joinReject")}
            labels={{ fix: at(locale, "errorFix") }}
          >
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="locale" value={locale} />
            <TextArea label={at(locale, "joinRejectReason")} name="reason" rows={2} dir="auto" />
          </ActionForm>
        </>
      ) : null}
    </>
  );
}
