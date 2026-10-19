import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminKindDto, FieldCapturesDto, FieldStatusDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { JOIN_STATUS_KEY, receivedAt } from "@/admin/join-view";
import { adminHref } from "@/admin/routes";
import { StreetCapture } from "@/admin/street/StreetCapture";
import { INTL_TAG, isLocale } from "@/lib/locale";
import { PageHead } from "@/admin/ui";
import styles from "@/admin/admin.module.css";
import own from "@/admin/street/street.module.css";

/**
 * Add from the street: the capture screen, today's count and the admin's own captures. Each
 * capture is a draft with a request in Join requests; approving it there publishes it.
 */
export default async function StreetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const api = await adminApi();
  const [kinds, status, mine] = await Promise.all([
    api.kinds.list({ query: { status: "active" } }).then((r) => okOr<AdminKindDto[]>(r, locale)),
    api.field.status().then((r) => okOr<FieldStatusDto>(r, locale)),
    api.field.mine().then((r) => okOr<FieldCapturesDto>(r, locale)),
  ]);
  const collator = new Intl.Collator(INTL_TAG[locale]);
  const options = kinds
    .map((k) => ({ slug: k.slug, label: pickText(k.name, locale) || k.slug }))
    .sort((a, b) => collator.compare(a.label, b.label));
  return (
    <div className={styles.narrow}>
      <PageHead
        title={at(locale, "navStreet")}
        sub={at(locale, "streetIntro")}
        actions={
          <p className={own.today} aria-live="polite">
            {at(locale, "streetToday", { count: mine.today })}
          </p>
        }
      />
      <StreetCapture
        locale={locale}
        kinds={options}
        reading={status.reading}
        uploads={status.uploads}
      />
      {mine.items.length ? (
        <section
          className={styles.card}
          aria-labelledby="street-mine"
          style={{ marginBlockStart: 24 }}
        >
          <h2 id="street-mine" className={styles.h2}>
            {at(locale, "streetMine")}
          </h2>
          <ul className={own.mine}>
            {mine.items.map((c) => (
              <li key={c.id} className={own.mineItem}>
                <Link href={adminHref(locale, `/join-requests/${c.id}`)}>
                  <bdi>{pickText(c.businessName, locale)}</bdi>
                </Link>
                <span
                  className={
                    c.status === "pending" ? `${styles.badge} ${styles.badgeGold}` : styles.badge
                  }
                >
                  {at(locale, JOIN_STATUS_KEY[c.status])}
                </span>
                <time dateTime={c.createdAt} className={styles.hint}>
                  {receivedAt(locale, c.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
