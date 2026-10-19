import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BUSINESS_ISSUES,
  BUSINESS_ORIGINS,
  type AdminBusinessRowDto,
  type AdminKindDto,
  type AdminSectorDto,
} from "@darb/contracts";
import { pickText, TIERS, type Locale } from "@darb/core";
import { AdminIcon } from "@/admin/AdminIcon";
import { adminApi, okOr } from "@/admin/api";
import { BulkBar } from "@/admin/BulkBar";
import { at, type AdminKey } from "@/admin/copy";
import { placeOptions } from "@/admin/list-actions";
import { ariaSort, listHref, pageOf, readList, sortHref } from "@/admin/list-params";
import { ListToolbar, type ListFilter } from "@/admin/ListToolbar";
import { toolbarLabels } from "@/admin/list-labels";
import { ISSUE_KEY, SOURCE_KEY, TIER_KEY } from "@/admin/labels";
import { mediaThumb } from "@/admin/media";
import { one, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { TakedownWarning } from "@/admin/TakedownWarning";
import {
  Empty,
  Monogram,
  numberFormat,
  Owner,
  PageHead,
  Pager,
  relativeTime,
  Status,
} from "@/admin/ui";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

type Page = { items: AdminBusinessRowDto[]; nextCursor: string | null; total?: number };

const KEYS = [
  "q",
  "status",
  "sector",
  "kind",
  "place",
  "tier",
  "source",
  "issue",
  "sort",
  "dir",
  "page",
  "examples",
] as const;
const SIZE = 50;

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
  const state = readList(sp, KEYS);
  // After a delete the web did not confirm: the deleted business's id, for its Retry.
  const stale = one(sp.stale);
  const page = pageOf(sp);
  const api = await adminApi();
  const tier = TIERS.find((t) => t === state.tier);
  const source = BUSINESS_ORIGINS.find((s) => s === state.source);
  const issue = BUSINESS_ISSUES.find((s) => s === state.issue);
  const sort = (["updated", "created", "name"] as const).find((s) => s === state.sort);
  const [list, kinds, sectors, chosenPlace] = await Promise.all([
    api.businesses
      .list({
        query: {
          q: state.q,
          status: state.status,
          sector: state.sector,
          kind: state.kind,
          place: state.place,
          tier,
          source,
          issue,
          sort,
          dir: state.dir === "asc" || state.dir === "desc" ? state.dir : undefined,
          page,
          limit: SIZE,
          locale,
          // Showroom examples only when asked for (?examples=1); admin works on real businesses.
          examples: state.examples === "1" ? "1" : undefined,
        },
      })
      .then((r) => okOr<Page>(r, locale)),
    api.kinds.list({ query: {} }).then((r) => okOr<AdminKindDto[]>(r, locale)),
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
    state.place
      ? api.places
          .list({ query: { q: state.place, limit: 5 } })
          .then((r) =>
            r.status === 200 ? r.body.items.find((p) => p.slug === state.place) : undefined,
          )
      : undefined,
  ]);
  const t = (key: AdminKey, vars?: Record<string, string | number>) => at(locale, key, vars);
  const base = adminHref(locale, "/businesses");
  const n = numberFormat(locale);
  const total = list.total ?? list.items.length;
  const name = (l: Parameters<typeof pickText>[0] | undefined) => (l ? pickText(l, locale) : "");
  const sectorKinds = state.sector
    ? kinds.filter((k) => sectors.find((s) => s.slug === state.sector)?.id === k.sectorId)
    : kinds;
  const kindOptions = sectorKinds
    .map((k) => ({ value: k.slug, label: name(k.name), note: n.format(k.businessCount) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  const filters: ListFilter[] = [
    {
      name: "status",
      label: t("status"),
      options: (["published", "draft", "suspended"] as const).map((s) => ({
        value: s,
        label: t(
          s === "published" ? "statusPublished" : s === "draft" ? "statusDraft" : "statusSuspended",
        ),
      })),
    },
    {
      name: "sector",
      label: t("fieldSector"),
      options: sectors.map((s) => ({
        value: s.slug,
        label: name(s.name),
        swatch: s.accent,
        note: s.businessCount !== undefined ? n.format(s.businessCount) : undefined,
      })),
    },
    { name: "kind", label: t("fieldPrimaryKind"), options: kindOptions, searchable: true },
    {
      name: "place",
      label: t("fieldPlace"),
      options: [],
      remote: placeOptions.bind(null, locale),
      chosenLabel: chosenPlace ? name(chosenPlace.name) : undefined,
    },
    {
      name: "tier",
      label: t("fieldTier"),
      options: TIERS.filter((x) => x !== "example").map((x) => ({
        value: x,
        label: t(TIER_KEY[x]),
      })),
    },
    {
      name: "source",
      label: t("fieldSource"),
      options: BUSINESS_ORIGINS.map((s) => ({ value: s, label: t(SOURCE_KEY[s]) })),
    },
    {
      name: "issue",
      label: t("fieldIssue"),
      options: BUSINESS_ISSUES.map((s) => ({ value: s, label: t(ISSUE_KEY[s]) })),
    },
  ];

  const sortHead = (
    column: "name" | "updated" | "created",
    label: string,
    natural: "asc" | "desc",
    isDefault = false,
  ) => (
    <th scope="col" aria-sort={ariaSort(state, column, natural, isDefault)}>
      <Link
        href={sortHref(base, state, column, natural)}
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
        title={t("navBusinesses")}
        sub={t("businessesCount", { count: n.format(total) })}
        actions={
          <Link href={adminHref(locale, "/businesses/new")} className={styles.primary}>
            <AdminIcon name="plus" size={18} />
            {t("newBusiness")}
          </Link>
        }
      />
      {stale ? <TakedownWarning locale={locale} entity="business" id={stale} back="list" /> : null}
      <ListToolbar
        base={base}
        state={state}
        filters={filters}
        labels={toolbarLabels(locale, "searchBusinesses")}
      />
      {list.items.length === 0 ? (
        <div className={styles.tableWrap}>
          <Empty icon="store" title={t("noMatches")}>
            {Object.values(state).some(Boolean) ? (
              <Link href={base} className={`${styles.ghost} ${styles.sm}`}>
                {t("clearFilters")}
              </Link>
            ) : null}
          </Empty>
        </div>
      ) : (
        <BulkBar
          locale={locale}
          kinds={kinds
            .filter((k) => k.status === "active")
            .map((k) => ({ id: k.id, name: name(k.name) }))
            .sort((a, b) => a.name.localeCompare(b.name, locale))}
          labels={{
            selected: t("bulkSelected"),
            selectAll: t("bulkSelectAll"),
            clear: t("bulkClear"),
            publish: t("publish"),
            draft: t("toDraft"),
            suspend: t("bulkSuspend"),
            kind: t("bulkKind"),
            confirmTitle: {
              publish: t("bulkPublishTitle"),
              draft: t("bulkDraftTitle"),
              suspend: t("bulkSuspendTitle"),
              kind: t("bulkKindTitle"),
            },
            confirmBody: {
              publish: t("bulkPublishBody"),
              draft: t("bulkDraftBody"),
              suspend: t("bulkSuspendBody"),
              kind: t("bulkKindBody"),
            },
            chooseKind: t("gapChooseKindPlain"),
            confirm: t("bulkConfirm"),
            cancel: t("cancel"),
          }}
        >
          <div className={styles.tableWrap}>
            <table className={styles.table} data-list="businesses">
              <caption className={styles.srOnly}>{t("navBusinesses")}</caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.checkCell}>
                    <input type="checkbox" name="pick-all" aria-label={t("bulkSelectAll")} />
                  </th>
                  {sortHead("name", t("fieldName"), "asc")}
                  <th scope="col">{t("fieldPlace")}</th>
                  <th scope="col">{t("fieldPrimaryKind")}</th>
                  <th scope="col">{t("fieldTier")}</th>
                  <th scope="col">{t("status")}</th>
                  {sortHead("updated", t("fieldUpdated"), "desc", true)}
                </tr>
              </thead>
              <tbody>
                {list.items.map((b) => {
                  const label = name(b.name) || b.slug;
                  const thumb = mediaThumb(b.thumb);
                  return (
                    <tr key={b.id} className={styles.linkedRow} data-row={b.id}>
                      <td className={styles.checkCell} data-cell="check">
                        <input
                          type="checkbox"
                          name="pick"
                          value={b.id}
                          aria-label={t("bulkPick", { name: label })}
                        />
                      </td>
                      <td data-cell="main">
                        <div className={styles.cellMain}>
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt=""
                              width={40}
                              height={40}
                              className={styles.thumb}
                              loading="lazy"
                            />
                          ) : (
                            <Monogram name={label} locale={locale as Locale} />
                          )}
                          <span className={styles.cellText}>
                            <Link
                              href={adminHref(locale, `/businesses/${b.id}`)}
                              className={styles.rowLink}
                            >
                              <bdi>{label}</bdi>
                            </Link>
                            <span className={styles.secondary}>
                              <bdi>{name(b.kindName)}</bdi>
                              <span className={styles.phoneOnly}>
                                {" · "}
                                <bdi>{name(b.placeName)}</bdi>
                              </span>
                            </span>
                          </span>
                          <Owner locale={locale} editedAt={b.editedAt} />
                        </div>
                      </td>
                      <td data-phone="hide">
                        <bdi>{name(b.placeName) || b.placeSlug}</bdi>
                      </td>
                      <td data-phone="hide">
                        <bdi>{name(b.kindName)}</bdi>
                      </td>
                      <td data-phone="hide">{t(TIER_KEY[b.tier])}</td>
                      <td data-cell="status">
                        <Status locale={locale} status={b.status} />
                      </td>
                      <td data-phone="hide" className={styles.muted}>
                        <time
                          dateTime={b.updatedAt}
                          title={new Date(b.updatedAt).toLocaleString(locale)}
                        >
                          {relativeTime(locale, b.updatedAt)}
                        </time>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </BulkBar>
      )}
      <Pager
        locale={locale}
        page={page}
        size={SIZE}
        total={total}
        href={(p) => listHref(base, state, { page: String(Math.max(1, p)) })}
      />
    </div>
  );
}
