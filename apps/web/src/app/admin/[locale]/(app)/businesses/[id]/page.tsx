import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminBusinessDto, AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { StatusBadge } from "@/admin/Badges";
import { BusinessForm } from "@/admin/BusinessForm";
import { at } from "@/admin/copy";
import { EntityMeta } from "@/admin/EntityMeta";
import { StatusActions } from "@/admin/StatusActions";
import { isLocale } from "@/lib/locale";
import { href, paths } from "@/lib/routes";
import styles from "@/admin/admin.module.css";

export default async function EditBusiness({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const api = await adminApi();
  const [b, kinds, sectors] = await Promise.all([
    api.businesses.get({ params: { id } }).then((r) => okOr<AdminBusinessDto>(r, locale)),
    api.kinds.list({ query: {} }).then((r) => okOr<AdminKindDto[]>(r, locale)),
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
  ]);
  const kind = kinds.find((k) => k.id === b.primaryKindId);
  const sector = sectors.find((s) => s.id === kind?.sectorId);
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{pickText(b.name, locale)}</h1>
        <StatusBadge locale={locale} status={b.status} />
        {kind && sector && b.status === "published" ? (
          <Link
            className={styles.ghost}
            href={href(locale, paths.business(b.placeSlug, sector.slug, kind.slug, b.slug))}
            target="_blank"
            rel="noopener"
          >
            {at(locale, "openPublic")}
          </Link>
        ) : null}
      </div>
      <p className={styles.hint} dir="ltr">
        {b.placeSlug}/{b.slug} · {b.source} · {b.tier}
      </p>
      <StatusActions locale={locale} business={b} />
      <BusinessForm locale={locale} kinds={kinds} business={b} />
      <EntityMeta locale={locale} entity="business" id={b.id} editedAt={b.editedAt} />
    </>
  );
}
