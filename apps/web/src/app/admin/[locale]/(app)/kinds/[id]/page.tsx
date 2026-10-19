import { notFound } from "next/navigation";
import type { AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { AdminIcon } from "@/admin/AdminIcon";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { Section } from "@/admin/editor-parts";
import { EntityMeta } from "@/admin/EntityMeta";
import { KindForm } from "@/admin/KindForm";
import { one, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { TakedownWarning } from "@/admin/TakedownWarning";
import { numberFormat, PageHead, Status } from "@/admin/ui";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function EditKind({
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
  const [k, sectors, kinds] = await Promise.all([
    api.kinds.get({ params: { id } }).then((r) => okOr<AdminKindDto>(r, locale)),
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
    api.kinds.list({ query: {} }).then((r) => okOr<AdminKindDto[]>(r, locale)),
  ]);
  const sector = sectors.find((s) => s.id === k.sectorId);
  return (
    <>
      <PageHead
        title={<bdi>{pickText(k.name, locale)}</bdi>}
        back={{ href: adminHref(locale, "/kinds"), label: at(locale, "navKinds") }}
      >
        <div className={styles.statusLine}>
          <Status locale={locale} status={k.status} />
          <span>
            <bdi>{sector ? pickText(sector.name, locale) : ""}</bdi>
          </span>
          <a href={adminHref(locale, `/businesses?kind=${k.slug}`)}>
            <AdminIcon name="store" size={15} />
            {at(locale, "businessesCount", { count: numberFormat(locale).format(k.businessCount) })}
          </a>
        </div>
      </PageHead>
      {stale ? <TakedownWarning locale={locale} entity="kind" id={k.id} back="page" /> : null}
      <KindForm
        locale={locale}
        kind={k}
        sectors={sectors}
        kinds={kinds}
        after={
          <Section id="advanced" title={at(locale, "secAdvanced")}>
            <EntityMeta
              locale={locale}
              entity="kind"
              id={k.id}
              editedAt={k.editedAt}
              seedSource={k.seedSource}
            />
          </Section>
        }
      />
    </>
  );
}
