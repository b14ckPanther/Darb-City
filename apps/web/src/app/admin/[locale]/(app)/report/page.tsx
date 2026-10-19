import { notFound } from "next/navigation";
import type { AdminKindDto, MissingReportDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { AdminIcon } from "@/admin/AdminIcon";
import { SearchGaps } from "@/admin/SearchGaps";
import { numberFormat, PageHead, StatusTabs } from "@/admin/ui";
import { adminApi, okOr } from "@/admin/api";
import { at, type AdminKey } from "@/admin/copy";
import { one, withParams, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

const DAYS = ["7", "30", "90"];

/** Spec §4.7: what people searched for and did not find. Raw visitor text: private (Plan 3 note). */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const raw = one((await searchParams).days);
  const days = DAYS.includes(raw ?? "") ? Number(raw) : 30;
  const report = okOr<MissingReportDto>(
    await (await adminApi()).misc.report({ query: { days, limit: 100 } }),
    locale,
  );
  const sections: [AdminKey, MissingReportDto["missingKinds"]][] = [
    ["reportMissingKinds", report.missingKinds],
    ["reportMissingPlaces", report.missingPlaces],
    ["reportNoResults", report.noResults],
  ];
  const n = numberFormat(locale);
  const kinds = (await (await adminApi()).kinds.list({ query: { status: "active" } })).body;
  const kindOptions = (Array.isArray(kinds) ? (kinds as AdminKindDto[]) : [])
    .map((k) => ({ id: k.id, name: pickText(k.name, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return (
    <div className={styles.narrow}>
      <PageHead title={at(locale, "navReport")} sub={at(locale, "reportIntro")} />
      <p className={styles.notice} role="note">
        <AdminIcon name="alert" size={18} />
        <span>{at(locale, "reportSensitive")}</span>
      </p>
      <StatusTabs
        label={at(locale, "reportPeriod")}
        tabs={DAYS.map((d) => ({
          href: withParams(adminHref(locale, "/report"), { days: d === "30" ? undefined : d }),
          label: at(locale, "reportDays", { days: d }),
          current: String(days) === d,
        }))}
      />
      <section className={styles.panel} aria-labelledby="reportMissingKinds">
        <div className={styles.panelHead}>
          <h2 id="reportMissingKinds" className={styles.h2}>
            {at(locale, "reportMissingKinds")}
          </h2>
        </div>
        <SearchGaps
          locale={locale}
          terms={report.missingKinds}
          kinds={kindOptions}
          labels={{
            term: at(locale, "term"),
            count: at(locale, "count"),
            empty: at(locale, "gapsEmpty"),
            createKind: at(locale, "gapCreateKind"),
            addWord: at(locale, "gapAddWord"),
            chooseKind: at(locale, "gapChooseKind"),
            add: at(locale, "gapAdd"),
            added: at(locale, "gapAdded"),
            failed: at(locale, "gapFailed"),
            cancel: at(locale, "cancel"),
          }}
          newKindHref={adminHref(locale, "/kinds/new")}
        />
      </section>
      {sections.slice(1).map(([key, rows]) => (
        <section key={key} className={styles.panel} aria-labelledby={key}>
          <div className={styles.panelHead}>
            <h2 id={key} className={styles.h2}>
              {at(locale, key)}
            </h2>
          </div>
          {rows.length === 0 ? (
            <p className={styles.muted}>{at(locale, "empty")}</p>
          ) : (
            <ul className={styles.terms} role="list">
              {rows.map((r) => (
                <li key={r.term}>
                  <bdi>{r.term}</bdi>
                  <span className={`${styles.num} ${styles.muted}`}>
                    {n.format(r.count)} <span className={styles.srOnly}>{at(locale, "count")}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
