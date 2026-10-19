import Link from "next/link";
import { notFound } from "next/navigation";
import type {
  AdminBusinessDto,
  AdminJoinRequestDto,
  AdminKindDto,
  AdminSectorDto,
} from "@darb/contracts";
import { AdminIcon } from "@/admin/AdminIcon";
import { PageHead, Status } from "@/admin/ui";
import { pickText } from "@darb/core";
import { ActionButton } from "@/admin/ActionButton";
import { ActionForm } from "@/admin/ActionForm";
import { adminApi, okOr } from "@/admin/api";
import { BusinessForm } from "@/admin/BusinessForm";
import { at } from "@/admin/copy";
import { TextArea } from "@/admin/fields";
import { approveJoin, rejectJoin } from "@/admin/join-actions";
import { joinSourceKey, receivedAt, telHref } from "@/admin/join-view";
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
  const [business, kinds, sectors, status] = await Promise.all([
    r.businessId
      ? api.businesses
          .get({ params: { id: r.businessId } })
          .then((res) => (res.status === 200 ? (res.body as AdminBusinessDto) : null))
      : Promise.resolve(null),
    api.kinds.list({ query: {} }).then((res) => okOr<AdminKindDto[]>(res, locale)),
    api.sectors.list().then((res) => okOr<AdminSectorDto[]>(res, locale)),
    getJoinStatus(),
  ]);
  const s = r.lookup;
  const waiting = r.status === "pending";
  const street = r.source === "field";
  return (
    <>
      <PageHead
        title={<bdi>{pickText(r.businessName, locale)}</bdi>}
        back={{ href: adminHref(locale, "/join-requests"), label: at(locale, "navJoin") }}
        actions={
          waiting && business ? (
            <ActionButton
              action={approveJoin}
              fields={{ id: r.id, locale }}
              label={at(locale, "joinApprove")}
              className={styles.primary}
              icon={<AdminIcon name="check" size={18} />}
              done={at(locale, "donePublished")}
            />
          ) : null
        }
      >
        <div className={styles.statusLine}>
          <Status locale={locale} status={r.status} />
          <span>
            {r.helper ? (
              <>
                {at(locale, "helperFrom")} ·{" "}
                <bdi>{r.helper.name || at(locale, "helperNoName")}</bdi>
              </>
            ) : (
              at(locale, joinSourceKey(r.source))
            )}
          </span>
          <time dateTime={r.createdAt}>{receivedAt(locale, r.createdAt)}</time>
        </div>
      </PageHead>
      <div className={styles.joinTop}>
        {street ? (
          <section className={styles.panel} aria-labelledby="join-sign">
            <h2 id="join-sign" className={styles.h2}>
              {at(locale, "streetSign")}
            </h2>
            {r.helper ? (
              <p className={styles.hint}>
                {at(locale, "helperFrom")} ·{" "}
                <Link href={adminHref(locale, `/join-requests?helper=${r.helper.id}`)}>
                  <bdi>{r.helper.name || at(locale, "helperNoName")}</bdi>
                </Link>
              </p>
            ) : (
              <p className={styles.hint}>{at(locale, "streetAddedBy")}</p>
            )}
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
          <section className={styles.panel} aria-labelledby="join-owner">
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
              <dd>{{ he: "עברית", ar: "العربية", en: "English" }[r.locale]}</dd>
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
          <section className={styles.panel} aria-labelledby="join-lookup">
            <h2 id="join-lookup" className={styles.h2}>
              {at(locale, "joinSuggested")}
            </h2>
            <details>
              <summary className={styles.hint}>{at(locale, "joinSuggestedRaw")}</summary>
              <pre className={styles.message} dir="ltr">
                {JSON.stringify({ ...s, sources: undefined }, null, 2)}
              </pre>
            </details>
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
      </div>
      {business ? (
        <>
          {waiting ? (
            <p className={styles.notice}>
              <AdminIcon name="alert" size={18} />
              <span>{at(locale, "joinSaveFirst")}</span>
            </p>
          ) : null}
          <BusinessForm
            locale={locale}
            kinds={kinds}
            sectors={sectors}
            business={business}
            placeName={business.placeName ? pickText(business.placeName, locale) : null}
            uploads={status.uploads}
          />
        </>
      ) : (
        <p className={styles.hint}>{at(locale, "joinDraftGone")}</p>
      )}
      {waiting && business ? (
        <section
          className={`${styles.panel} ${styles.narrow}`}
          aria-labelledby="join-reject"
          style={{ marginBlockStart: 24 }}
        >
          <h2 id="join-reject" className={styles.h2}>
            {at(locale, "joinReject")}
          </h2>
          <ActionForm
            action={rejectJoin}
            submit={at(locale, "joinReject")}
            labels={{ fix: at(locale, "errorFix") }}
          >
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="locale" value={locale} />
            <TextArea label={at(locale, "joinRejectReason")} name="reason" rows={2} dir="auto" />
          </ActionForm>
        </section>
      ) : null}
    </>
  );
}
