import { notFound } from "next/navigation";
import type { AdminPlaceDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { AdminIcon } from "@/admin/AdminIcon";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { Section } from "@/admin/editor-parts";
import { EntityMeta } from "@/admin/EntityMeta";
import { PLACE_TYPE_KEY } from "@/admin/labels";
import { one, type SearchParams } from "@/admin/params";
import { PlaceForm } from "@/admin/PlaceForm";
import { adminHref } from "@/admin/routes";
import { TakedownWarning } from "@/admin/TakedownWarning";
import { PageHead, Status } from "@/admin/ui";
import { isLocale } from "@/lib/locale";
import { href } from "@/lib/routes";
import styles from "@/admin/admin.module.css";

export default async function EditPlace({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, id } = await params;
  const stale = one((await searchParams).stale) === "1";
  if (!isLocale(locale)) notFound();
  const p = okOr<AdminPlaceDto>(await (await adminApi()).places.get({ params: { id } }), locale);
  return (
    <>
      <PageHead
        title={<bdi>{pickText(p.name, locale)}</bdi>}
        back={{ href: adminHref(locale, "/places"), label: at(locale, "navPlaces") }}
        actions={
          <a className={styles.ghost} href={href(locale, [p.slug])} target="_blank" rel="noopener">
            <AdminIcon name="external" size={18} />
            {at(locale, "openPublic")}
          </a>
        }
      >
        <div className={styles.statusLine}>
          <Status locale={locale} status={p.status} />
          <span>{at(locale, PLACE_TYPE_KEY[p.type])}</span>
          <a href={adminHref(locale, `/businesses?place=${p.slug}`)}>
            <AdminIcon name="store" size={15} />
            {at(locale, "navBusinesses")}
          </a>
        </div>
      </PageHead>
      {stale ? <TakedownWarning locale={locale} entity="place" id={p.id} back="page" /> : null}
      <PlaceForm
        locale={locale}
        place={p}
        after={
          <Section id="advanced" title={at(locale, "secAdvanced")}>
            <EntityMeta
              locale={locale}
              entity="place"
              id={p.id}
              editedAt={p.editedAt}
              seedSource={p.seedSource}
            />
          </Section>
        }
      />
    </>
  );
}
