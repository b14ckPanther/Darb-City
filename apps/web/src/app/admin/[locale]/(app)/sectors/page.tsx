import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { AdminIcon } from "@/admin/AdminIcon";
import { adminApi, okOr } from "@/admin/api";
import { at, type AdminKey } from "@/admin/copy";
import { adminHref } from "@/admin/routes";
import { numberFormat, Owner, PageHead } from "@/admin/ui";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";
import c from "@/admin/catalog.module.css";

/** The categories as the city shows them: a tile each, in order, with their colour and counts. */
export default async function SectorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sectors = okOr<AdminSectorDto[]>(await (await adminApi()).sectors.list(), locale);
  const t = (key: AdminKey, vars?: Record<string, string | number>) => at(locale, key, vars);
  const n = numberFormat(locale);
  return (
    <div className={styles.page}>
      <PageHead
        title={t("navSectors")}
        sub={t("sectorsCount", { count: n.format(sectors.length) })}
        actions={
          <Link href={adminHref(locale, "/sectors/new")} className={styles.primary}>
            <AdminIcon name="plus" size={18} />
            {t("newSector")}
          </Link>
        }
      />
      <ul className={c.tiles} role="list" data-list="sectors">
        {sectors.map((s) => (
          <li key={s.id} className={c.tile} style={{ "--tile": s.accent } as React.CSSProperties}>
            <span className={c.order} aria-hidden="true">
              {s.order}
            </span>
            <span className={c.tileText}>
              <Link href={adminHref(locale, `/sectors/${s.id}`)} className={styles.rowLink}>
                <bdi>{pickText(s.name, locale)}</bdi>
              </Link>
              <span className={styles.secondary}>
                <bdi>{pickText(s.tagline, locale)}</bdi>
              </span>
            </span>
            <span className={c.counts}>
              <Link
                href={adminHref(locale, `/kinds?sector=${s.slug}`)}
                className={c.count}
                aria-label={`${t("kindsCount", { count: n.format(s.kindCount ?? 0) })}: ${pickText(s.name, locale)}`}
              >
                {t("kindsCount", { count: n.format(s.kindCount ?? 0) })}
              </Link>
              <Link
                href={adminHref(locale, `/businesses?sector=${s.slug}`)}
                className={c.count}
                aria-label={`${t("businessesCount", { count: n.format(s.businessCount ?? 0) })}: ${pickText(s.name, locale)}`}
              >
                {t("businessesCount", { count: n.format(s.businessCount ?? 0) })}
              </Link>
            </span>
            <Owner locale={locale} editedAt={s.editedAt} />
          </li>
        ))}
      </ul>
    </div>
  );
}
