import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminPlaceDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { OwnerBadge, StatusBadge } from "@/admin/Badges";
import { at } from "@/admin/copy";
import { one, withParams, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Pager, Toolbar } from "@/admin/Toolbar";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

type Page = { items: AdminPlaceDto[]; nextCursor: string | null };

export default async function PlacesPage({
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
  const status = one(sp.status);
  const page = okOr<Page>(
    await (await adminApi()).places.list({ query: { q, status, cursor: one(sp.cursor) } }),
    locale,
  );
  const base = adminHref(locale, "/places");
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{at(locale, "navPlaces")}</h1>
        <Link href={adminHref(locale, "/places/new")} className={styles.primary}>
          {at(locale, "newPlace")}
        </Link>
      </div>
      <Toolbar
        locale={locale}
        action={base}
        q={q}
        selects={[
          {
            name: "status",
            label: at(locale, "status"),
            value: status,
            options: [
              ["live", at(locale, "statusLive")],
              ["soon", at(locale, "statusSoon")],
            ],
          },
        ]}
      />
      {page.items.length === 0 ? (
        <p>{at(locale, "empty")}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{at(locale, "fieldName")}</th>
              <th scope="col">{at(locale, "fieldSlug")}</th>
              <th scope="col">{at(locale, "fieldType")}</th>
              <th scope="col">{at(locale, "status")}</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={adminHref(locale, `/places/${p.id}`)}>
                    {pickText(p.name, locale)}
                  </Link>
                </td>
                <td dir="ltr">{p.slug}</td>
                <td>{p.type}</td>
                <td>
                  <StatusBadge locale={locale} status={p.status} />{" "}
                  <OwnerBadge locale={locale} editedAt={p.editedAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager
        locale={locale}
        href={page.nextCursor ? withParams(base, { q, status, cursor: page.nextCursor }) : null}
      />
    </>
  );
}
