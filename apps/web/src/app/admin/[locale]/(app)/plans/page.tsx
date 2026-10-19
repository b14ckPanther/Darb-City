import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminPlanDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { AdminIcon } from "@/admin/AdminIcon";
import { at } from "@/admin/copy";
import { adminHref } from "@/admin/routes";
import { isLocale } from "@/lib/locale";
import { formatShekels } from "@/lib/pricing";
import { href, paths } from "@/lib/routes";
import { Empty, Owner, PageHead, Status, StatusTabs } from "@/admin/ui";
import styles from "@/admin/admin.module.css";

export default async function PlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const plans = okOr<AdminPlanDto[]>(await (await adminApi()).plans.list(), locale);
  return (
    <div className={styles.page}>
      <PageHead
        title={at(locale, "navPlans")}
        sub={at(locale, "plansHint")}
        actions={
          <>
            <a
              href={href(locale, paths.pricing())}
              className={styles.quiet}
              target="_blank"
              rel="noopener"
            >
              <AdminIcon name="external" size={18} />
              {at(locale, "openPublic")}
            </a>
            <Link href={adminHref(locale, "/plans/new")} className={styles.primary}>
              <AdminIcon name="plus" size={18} />
              {at(locale, "newPlan")}
            </Link>
          </>
        }
      />
      <StatusTabs
        label={at(locale, "navPlans")}
        tabs={[
          { href: adminHref(locale, "/plans"), label: at(locale, "plansTab"), current: true },
          {
            href: adminHref(locale, "/plans/texts"),
            label: at(locale, "pageTexts"),
            current: false,
          },
        ]}
      />
      {plans.length === 0 ? (
        <div className={styles.tableWrap}>
          <Empty icon="settings" title={at(locale, "empty")} />
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} data-list="plans">
            <caption className={styles.srOnly}>{at(locale, "navPlans")}</caption>
            <thead>
              <tr>
                <th scope="col">{at(locale, "fieldName")}</th>
                <th scope="col" className={styles.end}>
                  {at(locale, "pricePerMonth")}
                </th>
                <th scope="col">{at(locale, "status")}</th>
              </tr>
            </thead>
            <tbody>
              {[...plans]
                .sort((a, b) => a.order - b.order)
                .map((p) => (
                  <tr key={p.id} className={styles.linkedRow} data-row={p.id}>
                    <td data-cell="main">
                      <div className={styles.cellMain}>
                        <span className={styles.cellText}>
                          <Link
                            href={adminHref(locale, `/plans/${p.id}`)}
                            className={styles.rowLink}
                          >
                            <bdi>{pickText(p.name, locale)}</bdi>
                          </Link>
                          {p.tagline && pickText(p.tagline, locale) ? (
                            <span className={styles.secondary}>
                              <bdi>{pickText(p.tagline, locale)}</bdi>
                            </span>
                          ) : null}
                        </span>
                        {p.highlighted ? (
                          <span className={`${styles.badge} ${styles.badgeGold}`}>
                            {at(locale, "highlighted")}
                          </span>
                        ) : null}
                        <Owner locale={locale} editedAt={p.editedAt} />
                      </div>
                    </td>
                    <td className={`${styles.end} ${styles.num}`}>
                      {p.monthly === null ? (
                        at(locale, "priceCustom")
                      ) : (
                        <bdi>{formatShekels(p.monthly, locale)}</bdi>
                      )}
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
    </div>
  );
}
