import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminPlanDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { OwnerBadge, StatusBadge } from "@/admin/Badges";
import { at } from "@/admin/copy";
import { adminHref } from "@/admin/routes";
import { isLocale } from "@/lib/locale";
import { formatShekels } from "@/lib/pricing";
import { href, paths } from "@/lib/routes";
import styles from "@/admin/admin.module.css";

export default async function PlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const plans = okOr<AdminPlanDto[]>(await (await adminApi()).plans.list(), locale);
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{at(locale, "navPlans")}</h1>
        <Link href={adminHref(locale, "/plans/new")} className={styles.primary}>
          {at(locale, "newPlan")}
        </Link>
        <Link href={adminHref(locale, "/plans/texts")} className={styles.ghost}>
          {at(locale, "pageTexts")}
        </Link>
        <a href={href(locale, paths.pricing())} className={styles.ghost}>
          {at(locale, "openPublic")}
        </a>
      </div>
      {plans.length === 0 ? (
        <p>{at(locale, "empty")}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{at(locale, "fieldOrder")}</th>
              <th scope="col">{at(locale, "fieldName")}</th>
              <th scope="col">{at(locale, "pricePerMonth")}</th>
              <th scope="col">{at(locale, "status")}</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>{p.order}</td>
                <td>
                  <Link href={adminHref(locale, `/plans/${p.id}`)}>{pickText(p.name, locale)}</Link>
                  {p.highlighted ? (
                    <>
                      {" "}
                      <span className={`${styles.badge} ${styles.badgeGold}`}>
                        {at(locale, "highlighted")}
                      </span>
                    </>
                  ) : null}
                </td>
                <td>
                  {p.monthly === null ? (
                    at(locale, "priceCustom")
                  ) : (
                    <bdi>{formatShekels(p.monthly, locale)}</bdi>
                  )}
                </td>
                <td>
                  <StatusBadge locale={locale} status={p.status} />{" "}
                  <OwnerBadge locale={locale} editedAt={p.editedAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
