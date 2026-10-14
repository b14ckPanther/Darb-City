import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { OwnerBadge, StatusBadge } from "@/admin/Badges";
import { at } from "@/admin/copy";
import { one, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Toolbar } from "@/admin/Toolbar";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function KindsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const q = one(sp.q);
  const rawStatus = one(sp.status);
  const status = rawStatus === "active" || rawStatus === "hidden" ? rawStatus : undefined;
  const sector = one(sp.sector);
  const api = await adminApi();
  const [kinds, sectors] = await Promise.all([
    api.kinds.list({ query: { q, status, sector } }).then((r) => okOr<AdminKindDto[]>(r, locale)),
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
  ]);
  const sectorName = new Map(sectors.map((s) => [s.id, pickText(s.name, locale)]));
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{at(locale, "navKinds")}</h1>
        <Link href={adminHref(locale, "/kinds/new")} className={styles.primary}>
          {at(locale, "newKind")}
        </Link>
      </div>
      <p className={styles.notice}>{at(locale, "kindsHiddenHint")}</p>
      <Toolbar
        locale={locale}
        action={adminHref(locale, "/kinds")}
        q={q}
        selects={[
          {
            name: "status",
            label: at(locale, "status"),
            value: status,
            options: [
              ["active", at(locale, "statusActive")],
              ["hidden", at(locale, "statusHidden")],
            ],
          },
          {
            name: "sector",
            label: at(locale, "fieldSector"),
            value: sector,
            options: sectors.map((s) => [s.id, pickText(s.name, locale)]),
          },
        ]}
      />
      {kinds.length === 0 ? (
        <p>{at(locale, "empty")}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{at(locale, "fieldName")}</th>
              <th scope="col">{at(locale, "fieldSector")}</th>
              <th scope="col">{at(locale, "fieldTemplate")}</th>
              <th scope="col">{at(locale, "navBusinesses")}</th>
              <th scope="col">{at(locale, "status")}</th>
            </tr>
          </thead>
          <tbody>
            {kinds.map((k) => (
              <tr key={k.id}>
                <td>
                  <Link href={adminHref(locale, `/kinds/${k.id}`)}>{pickText(k.name, locale)}</Link>
                  <div className={styles.hint} dir="ltr">
                    {k.slug}
                  </div>
                </td>
                <td>{sectorName.get(k.sectorId)}</td>
                <td>{k.template}</td>
                <td>{k.businessCount}</td>
                <td>
                  <StatusBadge locale={locale} status={k.status} />{" "}
                  <OwnerBadge locale={locale} editedAt={k.editedAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
