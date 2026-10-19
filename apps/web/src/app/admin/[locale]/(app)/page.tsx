import Link from "next/link";
import { notFound } from "next/navigation";
import type {
  AdminKindDto,
  AdminOverviewDto,
  BusinessIssue,
  MissingReportDto,
} from "@darb/contracts";
import { pickText, type Locale } from "@darb/core";
import { AdminIcon, type AdminIconName } from "@/admin/AdminIcon";
import { adminApi, okOr } from "@/admin/api";
import { at, type AdminKey } from "@/admin/copy";
import { SearchGaps } from "@/admin/SearchGaps";
import { adminHref } from "@/admin/routes";
import { numberFormat, PageHead, relativeTime } from "@/admin/ui";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";
import o from "@/admin/overview.module.css";

const ENTITY_PATH: Record<string, string> = {
  business: "/businesses",
  place: "/places",
  kind: "/kinds",
  sector: "/sectors",
  plan: "/plans",
  text: "/plans/texts",
};
const ACTION_KEY: Record<string, AdminKey> = {
  create: "actCreate",
  update: "actUpdate",
  status: "actStatus",
  release: "actRelease",
  delete: "actDelete",
};
const ENTITY_KEY: Record<string, AdminKey> = {
  business: "entBusiness",
  place: "entPlace",
  kind: "entKind",
  sector: "entSector",
  plan: "entPlan",
  text: "entText",
};

/** A tiny bar chart of the last two weeks: drawn, never read (the total sits beside it). */
function Spark({ days }: { days: AdminOverviewDto["added"] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const w = 6;
  const gap = 3;
  return (
    <svg
      className={o.spark}
      viewBox={`0 0 ${days.length * (w + gap) - gap} 28`}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {days.map((d, i) => {
        const h = Math.max(2, Math.round((d.count / max) * 28));
        return <rect key={d.day} x={i * (w + gap)} y={28 - h} width={w} height={h} rx={1.5} />;
      })}
    </svg>
  );
}

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const api = await adminApi();
  const [overview, report, kinds] = await Promise.all([
    api.misc.overview().then((r) => okOr<AdminOverviewDto>(r, locale)),
    api.misc
      .report({ query: { days: 7, limit: 6 } })
      .then((r) => okOr<MissingReportDto>(r, locale)),
    api.kinds.list({ query: {} }).then((r) => (r.status === 200 ? (r.body as AdminKindDto[]) : [])),
  ]);
  const t = (key: AdminKey, vars?: Record<string, string | number>) => at(locale, key, vars);
  const n = numberFormat(locale);
  const c = overview.counts;
  const href = (path: string) => adminHref(locale, path);
  const today = new Intl.DateTimeFormat(locale === "ar" ? "ar-IL-u-nu-latn" : `${locale}-IL`, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(overview.generatedAt));
  const addedTotal = overview.added.reduce((s, d) => s + d.count, 0);

  const stats: { key: AdminKey; value: string; note?: string; href: string; tone?: "gold" }[] = [
    {
      key: "statPublished",
      value: n.format(c.published),
      note: c.suspended ? t("statSuspendedNote", { count: n.format(c.suspended) }) : undefined,
      href: href("/businesses?status=published"),
    },
    {
      key: "statDrafts",
      value: n.format(c.draft),
      href: href("/businesses?status=draft"),
    },
    {
      key: "statToReview",
      value: n.format(c.pendingJoins),
      note: c.streetPending ? t("statStreetNote", { count: n.format(c.streetPending) }) : undefined,
      href: href("/join-requests"),
      tone: c.pendingJoins > 0 ? "gold" : undefined,
    },
    {
      key: "statPlacesLive",
      value: n.format(c.placesLive),
      note: t("statOfTotal", { total: n.format(c.placesTotal) }),
      href: href("/places?status=live"),
    },
  ];

  type Attention = {
    icon: AdminIconName;
    key: AdminKey;
    count: number;
    href: string;
    tone?: "gold";
  };
  const attention: Attention[] = [
    {
      icon: "inbox" as const,
      key: "attnJoins" as const,
      count: c.pendingJoins - c.streetPending,
      href: href("/join-requests"),
      tone: "gold" as const,
    },
    {
      icon: "camera" as const,
      key: "attnStreet" as const,
      count: c.streetPending,
      href: href("/join-requests"),
      tone: "gold" as const,
    },
    {
      icon: "mail" as const,
      key: "attnInquiries" as const,
      count: c.newInquiries,
      href: href("/inquiries"),
      tone: "gold" as const,
    },
    ...(
      [
        ["pin-outside", "pin", "attnPinOutside"],
        ["pin-at-centre", "pin", "attnPinCentre"],
        ["no-phone", "phone", "attnNoPhone"],
        ["no-hours", "clock", "attnNoHours"],
      ] as [BusinessIssue, AdminIconName, AdminKey][]
    ).map(([issue, icon, key]): Attention => ({
      icon,
      key,
      count: overview.attention[issue] ?? 0,
      href: href(`/businesses?status=published&issue=${issue}`),
    })),
  ].filter((a) => a.count > 0);

  return (
    <div className={styles.page}>
      <PageHead
        title={t("navHome")}
        sub={today}
        actions={
          <>
            <Link href={href("/field")} className={styles.ghost}>
              <AdminIcon name="camera" size={18} />
              {t("navStreet")}
            </Link>
            <Link href={href("/businesses/new")} className={styles.primary}>
              <AdminIcon name="plus" size={18} />
              {t("newBusiness")}
            </Link>
          </>
        }
      />

      <section aria-label={t("statsLabel")} className={o.stats}>
        {stats.map((s) => (
          <Link key={s.key} href={s.href} className={o.stat} data-tone={s.tone} data-stat={s.key}>
            <span className={o.statLabel}>{t(s.key)}</span>
            <span className={`${o.statValue} ${styles.num}`}>{s.value}</span>
            {s.note ? <span className={o.statNote}>{s.note}</span> : null}
          </Link>
        ))}
        <div className={o.stat} data-stat="statAdded">
          <span className={o.statLabel}>{t("statAddedWeek")}</span>
          <span className={`${o.statValue} ${styles.num}`}>{n.format(c.addedThisWeek)}</span>
          <span className={o.statNote}>{t("statAddedNote", { count: n.format(addedTotal) })}</span>
          <Spark days={overview.added} />
        </div>
      </section>

      <div className={o.columns}>
        <section className={styles.panel} aria-labelledby="attention">
          <div className={styles.panelHead}>
            <h2 id="attention" className={styles.h2}>
              {t("attnTitle")}
            </h2>
          </div>
          {attention.length === 0 ? (
            <p className={o.allClear}>
              <AdminIcon name="check" />
              {t("attnClear")}
            </p>
          ) : (
            <ul className={o.queue} role="list">
              {attention.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className={o.queueRow} data-tone={a.tone}>
                    <span className={o.queueIcon}>
                      <AdminIcon name={a.icon} size={18} />
                    </span>
                    <span className={o.queueText}>{t(a.key)}</span>
                    <span className={`${o.queueCount} ${styles.num}`}>{n.format(a.count)}</span>
                    <AdminIcon name="chevron" size={16} className={o.chev} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="activity">
          <div className={styles.panelHead}>
            <h2 id="activity" className={styles.h2}>
              {t("activityTitle")}
            </h2>
          </div>
          {overview.activity.length === 0 ? (
            <p className={styles.muted}>{t("activityEmpty")}</p>
          ) : (
            <ol className={o.feed} role="list">
              {overview.activity.map((a) => (
                <li key={a.id} className={o.feedRow}>
                  <span className={o.feedDot} data-action={a.action} aria-hidden="true" />
                  <span className={o.feedText}>
                    <span>
                      {t(a.self ? "actYou" : "actSomeone")} {t(ACTION_KEY[a.action] ?? "actUpdate")}{" "}
                      <span className={styles.muted}>
                        {t(ENTITY_KEY[a.entityType] ?? "entBusiness")}
                      </span>{" "}
                      {a.name && a.action !== "delete" ? (
                        <Link
                          href={href(
                            a.entityType === "text"
                              ? "/plans/texts"
                              : `${ENTITY_PATH[a.entityType]}/${a.entityId}`,
                          )}
                        >
                          <bdi>{pickText(a.name, locale as Locale)}</bdi>
                        </Link>
                      ) : a.name ? (
                        <bdi>{pickText(a.name, locale as Locale)}</bdi>
                      ) : null}
                    </span>
                    <time dateTime={a.at} className={o.feedTime}>
                      {relativeTime(locale, a.at, new Date(overview.generatedAt).getTime())}
                    </time>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="gaps">
        <div className={styles.panelHead}>
          <div>
            <h2 id="gaps" className={styles.h2}>
              {t("gapsTitle")}
            </h2>
            <p className={styles.hint}>{t("gapsHint")}</p>
          </div>
          <Link href={href("/report")} className={`${styles.quiet} ${styles.sm}`}>
            {t("seeAll")}
            <AdminIcon name="chevron" size={16} className={o.chev} />
          </Link>
        </div>
        <SearchGaps
          locale={locale}
          terms={report.missingKinds}
          kinds={kinds
            .filter((k) => k.status === "active")
            .map((k) => ({ id: k.id, name: pickText(k.name, locale) }))
            .sort((a, b) => a.name.localeCompare(b.name, locale))}
          labels={{
            term: t("term"),
            count: t("count"),
            empty: t("gapsEmpty"),
            createKind: t("gapCreateKind"),
            addWord: t("gapAddWord"),
            chooseKind: t("gapChooseKind"),
            add: t("gapAdd"),
            added: t("gapAdded"),
            failed: t("gapFailed"),
            cancel: t("cancel"),
          }}
          newKindHref={href("/kinds/new")}
        />
      </section>
    </div>
  );
}
