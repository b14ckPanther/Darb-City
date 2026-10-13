import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminBusinessRowDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { OwnerBadge, StatusBadge } from "@/admin/Badges";
import { at } from "@/admin/copy";
import { one, withParams, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Pager, Toolbar } from "@/admin/Toolbar";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

type Page = { items: AdminBusinessRowDto[]; nextCursor: string | null };

export default async function BusinessesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const filters = {
    q: one(sp.q),
    status: one(sp.status),
    place: one(sp.place),
    kind: one(sp.kind),
  };
  const page = okOr<Page>(
    await (await adminApi()).businesses.list({ query: { ...filters, cursor: one(sp.cursor) } }),
    locale,
  );
  const base = adminHref(locale, "/businesses");
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{at(locale, "navBusinesses")}</h1>
        <Link href={adminHref(locale, "/businesses/new")} className={styles.primary}>
          {at(locale, "newBusiness")}
        </Link>
      </div>
      <Toolbar
        locale={locale}
        action={base}
        q={filters.q}
        selects={[
          {
            name: "status",
            label: at(locale, "status"),
            value: filters.status,
            options: [
              ["draft", at(locale, "statusDraft")],
              ["published", at(locale, "statusPublished")],
              ["suspended", at(locale, "statusSuspended")],
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
              <th scope="col">{at(locale, "fieldPlace")}</th>
              <th scope="col">{at(locale, "fieldTier")}</th>
              <th scope="col">{at(locale, "status")}</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={adminHref(locale, `/businesses/${b.id}`)}>
                    {pickText(b.name, locale)}
                  </Link>
                  <div className={styles.hint} dir="ltr">
                    {b.slug}
                  </div>
                </td>
                <td dir="ltr">{b.placeSlug}</td>
                <td>{b.tier}</td>
                <td>
                  <StatusBadge locale={locale} status={b.status} />{" "}
                  <OwnerBadge locale={locale} editedAt={b.editedAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager
        locale={locale}
        href={page.nextCursor ? withParams(base, { ...filters, cursor: page.nextCursor }) : null}
      />
    </>
  );
}
