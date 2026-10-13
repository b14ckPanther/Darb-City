import Link from "next/link";
import { notFound } from "next/navigation";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { adminHref } from "@/admin/routes";
import { isLocale } from "@/lib/locale";
import type { MissingReportDto } from "@darb/contracts";
import styles from "@/admin/admin.module.css";

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const report = okOr<MissingReportDto>(
    await (await adminApi()).misc.report({ query: { days: 7, limit: 5 } }),
    locale,
  );
  const cards = [
    ["/places", "navPlaces"],
    ["/kinds", "navKinds"],
    ["/businesses", "navBusinesses"],
    ["/sectors", "navSectors"],
  ] as const;
  return (
    <>
      <h1 className={styles.h1}>{at(locale, "navHome")}</h1>
      <div className={styles.grid}>
        {cards.map(([href, key]) => (
          <Link key={href} href={adminHref(locale, href)} className={styles.tile}>
            {at(locale, key)}
          </Link>
        ))}
      </div>
      <section className={styles.card} aria-labelledby="missing">
        <h2 id="missing" className={styles.h2}>
          {at(locale, "reportMissingKinds")} · {at(locale, "reportDays", { days: 7 })}
        </h2>
        {report.missingKinds.length === 0 ? (
          <p>{at(locale, "empty")}</p>
        ) : (
          <ul className={styles.plain}>
            {report.missingKinds.map((r) => (
              <li key={r.term}>
                <bdi>{r.term}</bdi> · {r.count}
              </li>
            ))}
          </ul>
        )}
        <Link href={adminHref(locale, "/report")}>{at(locale, "navReport")}</Link>
      </section>
    </>
  );
}
