import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { OwnerBadge } from "@/admin/Badges";
import { at } from "@/admin/copy";
import { adminHref } from "@/admin/routes";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function SectorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sectors = okOr<AdminSectorDto[]>(await (await adminApi()).sectors.list(), locale);
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{at(locale, "navSectors")}</h1>
        <Link href={adminHref(locale, "/sectors/new")} className={styles.primary}>
          {at(locale, "newSector")}
        </Link>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{at(locale, "fieldOrder")}</th>
            <th scope="col">{at(locale, "fieldName")}</th>
            <th scope="col">{at(locale, "fieldAccent")}</th>
            <th scope="col">{at(locale, "status")}</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((s) => (
            <tr key={s.id}>
              <td>{s.order}</td>
              <td>
                <Link href={adminHref(locale, `/sectors/${s.id}`)}>{pickText(s.name, locale)}</Link>
              </td>
              <td>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    inlineSize: 16,
                    blockSize: 16,
                    borderRadius: 4,
                    background: s.accent,
                    verticalAlign: "middle",
                  }}
                />{" "}
                <span dir="ltr">{s.accent}</span>
              </td>
              <td>
                <OwnerBadge locale={locale} editedAt={s.editedAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
