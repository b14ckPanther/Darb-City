import { notFound } from "next/navigation";
import type { MissingReportDto } from "@darb/contracts";
import { adminApi, okOr } from "@/admin/api";
import { at, type AdminKey } from "@/admin/copy";
import { one, type SearchParams } from "@/admin/params";
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
  return (
    <>
      <h1 className={styles.h1}>{at(locale, "reportTitle")}</h1>
      <p className={styles.notice} role="note">
        {at(locale, "reportSensitive")}
      </p>
      <form method="get" action={adminHref(locale, "/report")} className={styles.toolbar}>
        <label className={styles.field}>
          <span>{at(locale, "reportDays", { days })}</span>
          <select name="days" defaultValue={String(days)}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {at(locale, "reportDays", { days: d })}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={styles.ghost}>
          {at(locale, "search")}
        </button>
      </form>
      {sections.map(([key, rows]) => (
        <section key={key} className={styles.card} aria-labelledby={key}>
          <h2 id={key} className={styles.h2}>
            {at(locale, key)}
          </h2>
          {rows.length === 0 ? (
            <p>{at(locale, "empty")}</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{at(locale, "term")}</th>
                  <th scope="col">{at(locale, "count")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.term}>
                    <td>
                      <bdi>{r.term}</bdi>
                    </td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}
