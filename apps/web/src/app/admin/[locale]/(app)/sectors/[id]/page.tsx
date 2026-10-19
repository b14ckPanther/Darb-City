import { notFound } from "next/navigation";
import type { AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { AdminIcon } from "@/admin/AdminIcon";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { Section } from "@/admin/editor-parts";
import { EntityMeta } from "@/admin/EntityMeta";
import { adminHref } from "@/admin/routes";
import { SectorForm } from "@/admin/SectorForm";
import { numberFormat, PageHead } from "@/admin/ui";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function EditSector({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  // There is no single-sector GET: the list is short.
  const s = okOr<AdminSectorDto[]>(await (await adminApi()).sectors.list(), locale).find(
    (x) => x.id === id,
  );
  if (!s) notFound();
  const n = numberFormat(locale);
  return (
    <>
      <PageHead
        title={<bdi>{pickText(s.name, locale)}</bdi>}
        back={{ href: adminHref(locale, "/sectors"), label: at(locale, "navSectors") }}
      >
        <div className={styles.statusLine}>
          <span className={styles.swatch} style={{ background: s.accent }} aria-hidden="true" />
          <a href={adminHref(locale, `/kinds?sector=${s.slug}`)}>
            <AdminIcon name="tag" size={15} />
            {at(locale, "kindsCount", { count: n.format(s.kindCount ?? 0) })}
          </a>
          <a href={adminHref(locale, `/businesses?sector=${s.slug}`)}>
            <AdminIcon name="store" size={15} />
            {at(locale, "businessesCount", { count: n.format(s.businessCount ?? 0) })}
          </a>
        </div>
      </PageHead>
      <SectorForm
        locale={locale}
        sector={s}
        after={
          <Section id="advanced" title={at(locale, "secAdvanced")}>
            <EntityMeta
              locale={locale}
              entity="sector"
              id={s.id}
              editedAt={s.editedAt}
              seedSource={s.seedSource}
            />
          </Section>
        }
      />
    </>
  );
}
