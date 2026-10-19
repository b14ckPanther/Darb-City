import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { AdminIcon } from "@/admin/AdminIcon";
import { adminApi, okOr } from "@/admin/api";
import { at, type AdminKey } from "@/admin/copy";
import { TEMPLATE_KEY } from "@/admin/labels";
import { toolbarLabels } from "@/admin/list-labels";
import { ariaSort, readList, sortHref } from "@/admin/list-params";
import { ListToolbar, type ListFilter } from "@/admin/ListToolbar";
import type { SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Empty, numberFormat, Owner, PageHead, Status } from "@/admin/ui";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

const KEYS = ["q", "status", "sector", "sort", "dir"] as const;

/** Every kind (about 200), grouped by nothing but sortable: few enough to show on one page. */
export default async function KindsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const state = readList(await searchParams, KEYS);
  const status = state.status === "active" || state.status === "hidden" ? state.status : undefined;
  const api = await adminApi();
  const [kinds, sectors] = await Promise.all([
    api.kinds.list({ query: { q: state.q, status } }).then((r) => okOr<AdminKindDto[]>(r, locale)),
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
  ]);
  const t = (key: AdminKey, vars?: Record<string, string | number>) => at(locale, key, vars);
  const n = numberFormat(locale);
  const base = adminHref(locale, "/kinds");
  const sectorBy = new Map(sectors.map((s) => [s.id, s]));
  const bySlug = new Map(sectors.map((s) => [s.slug, s]));
  const name = (k: AdminKindDto) => pickText(k.name, locale);
  const sort = state.sort === "name" || state.sort === "businesses" ? state.sort : "sector";
  const dir =
    state.dir === "asc" || state.dir === "desc"
      ? state.dir
      : sort === "businesses"
        ? "desc"
        : "asc";
  const sign = dir === "asc" ? 1 : -1;
  const shown = { ...state, sort, dir };
  const rows = kinds
    .filter((k) => !state.sector || k.sectorId === bySlug.get(state.sector)?.id)
    .sort((a, b) =>
      sort === "name"
        ? sign * name(a).localeCompare(name(b), locale)
        : sort === "businesses"
          ? sign * (a.businessCount - b.businessCount) || name(a).localeCompare(name(b), locale)
          : sign *
            ((sectorBy.get(a.sectorId)?.order ?? 0) - (sectorBy.get(b.sectorId)?.order ?? 0) ||
              a.order - b.order),
    );
  const filters: ListFilter[] = [
    {
      name: "status",
      label: t("status"),
      options: [
        { value: "active", label: t("statusActive") },
        { value: "hidden", label: t("statusHidden") },
      ],
    },
    {
      name: "sector",
      label: t("fieldSector"),
      options: sectors.map((s) => ({
        value: s.slug,
        label: pickText(s.name, locale),
        swatch: s.accent,
        note: s.kindCount !== undefined ? n.format(s.kindCount) : undefined,
      })),
    },
  ];
  const head = (
    column: "name" | "sector" | "businesses",
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
        title={t("navKinds")}
        sub={t("kindsCount", { count: n.format(rows.length) })}
        actions={
          <Link href={adminHref(locale, "/kinds/new")} className={styles.primary}>
            <AdminIcon name="plus" size={18} />
            {t("newKind")}
          </Link>
        }
      />
      <ListToolbar
        base={base}
        state={state}
        filters={filters}
        labels={toolbarLabels(locale, "searchKinds")}
      />
      {rows.length === 0 ? (
        <div className={styles.tableWrap}>
          <Empty icon="tag" title={t("noMatches")}>
            <Link href={base} className={`${styles.ghost} ${styles.sm}`}>
              {t("clearFilters")}
            </Link>
          </Empty>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} data-list="kinds">
            <caption className={styles.srOnly}>{t("navKinds")}</caption>
            <thead>
              <tr>
                {head("name", t("fieldName"), "asc")}
                {head("sector", t("fieldSector"), "asc")}
                <th scope="col">{t("fieldTemplate")}</th>
                <th scope="col" className={styles.end}>
                  {t("fieldWords")}
                </th>
                {head("businesses", t("navBusinesses"), "desc", true)}
                <th scope="col">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((k) => {
                const sector = sectorBy.get(k.sectorId);
                const words = k.synonyms.he.length + k.synonyms.ar.length + k.synonyms.en.length;
                return (
                  <tr key={k.id} className={styles.linkedRow} data-row={k.id}>
                    <td data-cell="main">
                      <div className={styles.cellMain}>
                        <span
                          className={styles.colorBar}
                          style={{ background: sector?.accent }}
                          aria-hidden="true"
                        />
                        <span className={styles.cellText}>
                          <Link
                            href={adminHref(locale, `/kinds/${k.id}`)}
                            className={styles.rowLink}
                          >
                            <bdi>{name(k)}</bdi>
                          </Link>
                          <span className={`${styles.secondary} ${styles.phoneOnly}`}>
                            <bdi>{sector ? pickText(sector.name, locale) : ""}</bdi>
                            {" · "}
                            {t("businessesCount", { count: n.format(k.businessCount) })}
                          </span>
                        </span>
                        <Owner locale={locale} editedAt={k.editedAt} />
                      </div>
                    </td>
                    <td data-phone="hide">
                      <bdi>{sector ? pickText(sector.name, locale) : ""}</bdi>
                    </td>
                    <td data-phone="hide" className={styles.muted}>
                      {t(TEMPLATE_KEY[k.template])}
                    </td>
                    <td data-phone="hide" className={`${styles.end} ${styles.num} ${styles.muted}`}>
                      {n.format(words)}
                    </td>
                    <td data-phone="hide" className={`${styles.end} ${styles.num}`}>
                      {n.format(k.businessCount)}
                    </td>
                    <td data-cell="status">
                      <Status locale={locale} status={k.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
