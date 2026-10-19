import { notFound } from "next/navigation";
import type { AdminBusinessDto, AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { AdminIcon } from "@/admin/AdminIcon";
import { adminApi, okOr } from "@/admin/api";
import { BusinessForm } from "@/admin/BusinessForm";
import { at, type AdminKey } from "@/admin/copy";
import { EntityMeta } from "@/admin/EntityMeta";
import { ORIGIN_KEY, TIER_KEY } from "@/admin/labels";
import { one, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { StatusActions } from "@/admin/StatusActions";
import { PageHead, Status } from "@/admin/ui";
import { getJoinStatus } from "@/lib/api";
import { isLocale } from "@/lib/locale";
import { href, paths } from "@/lib/routes";
import styles from "@/admin/admin.module.css";
import e from "@/admin/editor.module.css";

export default async function EditBusiness({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, id } = await params;
  const stale = one((await searchParams).stale) === "1";
  if (!isLocale(locale)) notFound();
  const api = await adminApi();
  const [b, kinds, sectors, join] = await Promise.all([
    api.businesses.get({ params: { id } }).then((r) => okOr<AdminBusinessDto>(r, locale)),
    api.kinds.list({ query: {} }).then((r) => okOr<AdminKindDto[]>(r, locale)),
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
    getJoinStatus(),
  ]);
  const t = (key: AdminKey) => at(locale, key);
  const kind = kinds.find((k) => k.id === b.primaryKindId);
  const sector = sectors.find((s) => s.id === kind?.sectorId);
  const publicPath =
    kind && sector
      ? href(locale, paths.business(b.placeSlug, sector.slug, kind.slug, b.slug))
      : null;
  const placeName = b.placeName ? pickText(b.placeName, locale) : b.placeSlug;
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-IL-u-nu-latn" : `${locale}-IL`, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jerusalem",
    }).format(new Date(iso));
  return (
    <>
      <PageHead
        title={<bdi>{pickText(b.name, locale) || b.slug}</bdi>}
        back={{ href: adminHref(locale, "/businesses"), label: t("navBusinesses") }}
        actions={<StatusActions locale={locale} business={b} stale={stale} />}
      >
        <div className={styles.statusLine}>
          <Status locale={locale} status={b.status} />
          <span>
            <bdi>{kind ? pickText(kind.name, locale) : ""}</bdi> · <bdi>{placeName}</bdi>
          </span>
          {publicPath && b.status === "published" ? (
            <a href={publicPath} target="_blank" rel="noopener" data-open-public="">
              <AdminIcon name="external" size={15} />
              {t("openPublic")}
            </a>
          ) : null}
        </div>
      </PageHead>
      <BusinessForm
        locale={locale}
        kinds={kinds}
        sectors={sectors}
        business={b}
        placeName={placeName}
        uploads={join.uploads}
        advanced={
          <>
            <dl className={e.facts}>
              <dt>{t("fieldSource")}</dt>
              <dd>{t(ORIGIN_KEY[b.source])}</dd>
              <dt>{t("fieldTier")}</dt>
              <dd>{t(TIER_KEY[b.tier])}</dd>
              <dt>{t("fieldWebAddress")}</dt>
              <dd dir="ltr">
                {publicPath ? (
                  <a href={publicPath} target="_blank" rel="noopener">
                    {publicPath}
                  </a>
                ) : (
                  `${b.placeSlug}/${b.slug}`
                )}
              </dd>
              {b.createdAt ? (
                <>
                  <dt>{t("fieldCreated")}</dt>
                  <dd>{when(b.createdAt)}</dd>
                </>
              ) : null}
              <dt>{t("fieldUpdated")}</dt>
              <dd>{when(b.updatedAt)}</dd>
            </dl>
            <EntityMeta
              locale={locale}
              entity="business"
              id={b.id}
              editedAt={b.editedAt}
              seedSource={b.seedSource}
            />
          </>
        }
      />
    </>
  );
}
