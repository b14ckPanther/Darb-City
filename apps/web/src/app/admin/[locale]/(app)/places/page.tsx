import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminPlaceDto } from "@darb/contracts";
import { pickText, PLACE_TYPES } from "@darb/core";
import { AdminIcon } from "@/admin/AdminIcon";
import { adminApi, okOr } from "@/admin/api";
import { at, type AdminKey } from "@/admin/copy";
import { toolbarLabels } from "@/admin/list-labels";
import { ariaSort, listHref, pageOf, readList, sortHref } from "@/admin/list-params";
import { ListToolbar, type ListFilter } from "@/admin/ListToolbar";
import { PLACE_TYPE_KEY } from "@/admin/labels";
import type { SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Empty, numberFormat, Owner, PageHead, Pager, Status } from "@/admin/ui";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

type Page = { items: AdminPlaceDto[]; nextCursor: string | null; total?: number };
const KEYS = ["q", "status", "type", "sort", "dir", "page"] as const;
const SIZE = 50;

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
  const state = readList(sp, KEYS);
  const page = pageOf(sp);
  const type = PLACE_TYPES.find((x) => x === state.type);
  const sort = (["name", "population", "businesses"] as const).find((s) => s === state.sort);
  // Busiest first, unless searching: then the best name match leads.
  const effectiveSort = sort ?? (state.q ? "name" : "businesses");
  const list = okOr<Page>(
    await (
      await adminApi()
    ).places.list({
      query: {
        q: state.q,
        status: state.status,
        type,
        sort: effectiveSort,
        dir: state.dir === "asc" || state.dir === "desc" ? state.dir : undefined,
        page,
        limit: SIZE,
        locale,
      },
    }),
    locale,
  );
  const t = (key: AdminKey, vars?: Record<string, string | number>) => at(locale, key, vars);
  const base = adminHref(locale, "/places");
  const n = numberFormat(locale);
  const total = list.total ?? list.items.length;
  const shown = { ...state, sort: effectiveSort };
  const filters: ListFilter[] = [
    {
      name: "status",
      label: t("status"),
      options: [
        { value: "live", label: t("statusLive") },
        { value: "soon", label: t("statusSoon") },
      ],
    },
    {
      name: "type",
      label: t("fieldType"),
      options: PLACE_TYPES.filter((x) => x !== "country").map((x) => ({
        value: x,
        label: t(PLACE_TYPE_KEY[x]),
      })),
    },
  ];
  const head = (
    column: "name" | "population" | "businesses",
    label: string,
    natural: "asc" | "desc",
    end = false,
  ) => (
    <th
      scope="col"
      aria-sort={ariaSort(shown, column, natural)}
      className={end ? styles.end : undefined}
    >
      <Link
        href={sortHref(base, shown, column, natural)}
        className={styles.sortButton}
        scroll={false}
      >
        {label}
        <AdminIcon name="sort" size={14} />
      </Link>
    </th>
  );
  return (
    <div className={styles.page}>
      <PageHead
        title={t("navPlaces")}
        sub={t("placesCount", { count: n.format(total) })}
        actions={
          <Link href={adminHref(locale, "/places/new")} className={styles.primary}>
            <AdminIcon name="plus" size={18} />
            {t("newPlace")}
          </Link>
        }
      />
      <ListToolbar
        base={base}
        state={state}
        filters={filters}
        labels={toolbarLabels(locale, "searchPlaces")}
      />
      {list.items.length === 0 ? (
        <div className={styles.tableWrap}>
          <Empty icon="pin" title={t("noMatches")}>
            <Link href={base} className={`${styles.ghost} ${styles.sm}`}>
              {t("clearFilters")}
            </Link>
          </Empty>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} data-list="places">
            <caption className={styles.srOnly}>{t("navPlaces")}</caption>
            <thead>
              <tr>
                {head("name", t("fieldName"), "asc")}
                <th scope="col">{t("fieldType")}</th>
                <th scope="col">{t("fieldInside")}</th>
                {head("businesses", t("navBusinesses"), "desc", true)}
                {head("population", t("fieldPopulation"), "desc", true)}
                <th scope="col">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((p) => (
                <tr key={p.id} className={styles.linkedRow} data-row={p.id}>
                  <td data-cell="main">
                    <div className={styles.cellMain}>
                      <span className={styles.cellText}>
                        <Link
                          href={adminHref(locale, `/places/${p.id}`)}
                          className={styles.rowLink}
                        >
                          <bdi>{pickText(p.name, locale)}</bdi>
                        </Link>
                        <span className={`${styles.secondary} ${styles.phoneOnly}`}>
                          {t(PLACE_TYPE_KEY[p.type])}
                          {" · "}
                          {t("businessesCount", { count: n.format(p.businessCount ?? 0) })}
                        </span>
                      </span>
                      <Owner locale={locale} editedAt={p.editedAt} />
                    </div>
                  </td>
                  <td data-phone="hide">{t(PLACE_TYPE_KEY[p.type])}</td>
                  <td data-phone="hide" className={styles.muted}>
                    <bdi>{p.parentName ? pickText(p.parentName, locale) : ""}</bdi>
                  </td>
                  <td data-phone="hide" className={`${styles.end} ${styles.num}`}>
                    {n.format(p.businessCount ?? 0)}
                  </td>
                  <td data-phone="hide" className={`${styles.end} ${styles.num} ${styles.muted}`}>
                    {p.population ? n.format(p.population) : ""}
                  </td>
                  <td data-cell="status">
                    <Status locale={locale} status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        locale={locale}
        page={page}
        size={SIZE}
        total={total}
        href={(x) => listHref(base, state, { page: String(Math.max(1, x)) })}
      />
    </div>
  );
}
