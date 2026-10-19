import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminHelperDto, AdminHelperPageDto } from "@darb/contracts";
import { pickText, type Locale } from "@darb/core";
import { ActionButton } from "@/admin/ActionButton";
import { AdminIcon } from "@/admin/AdminIcon";
import { adminApi, okOr } from "@/admin/api";
import { at, type AdminKey } from "@/admin/copy";
import { decideHelper, setHelperLimit } from "@/admin/helper-actions";
import { LimitPicker } from "@/admin/LimitPicker";
import { acceptance, limitChoice } from "@/admin/helper-view";
import { telHref } from "@/admin/join-view";
import { one, withParams, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Empty, Monogram, PageHead, relativeTime, StatusTabs } from "@/admin/ui";
import { INTL_TAG, isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";
import h from "@/admin/helpers.module.css";

const TABS = [
  ["pending", "helpersWaiting"],
  ["approved", "helpersActive"],
  ["paused", "helpersPaused"],
] as const satisfies readonly (readonly [AdminHelperDto["status"], AdminKey])[];

/** What the one button on a helper's card does, by where they stand. */
const MOVE = {
  pending: { move: "approve", label: "helperApprove", done: "helperApproved", icon: "check" },
  approved: { move: "pause", label: "helperPause", done: "helperPausedDone", icon: "close" },
  paused: { move: "resume", label: "helperResume", done: "helperResumed", icon: "undo" },
} as const;

function Helper({ locale, item }: { locale: Locale; item: AdminHelperDto }) {
  const t = (key: AdminKey, vars?: Record<string, string | number>) => at(locale, key, vars);
  const n = new Intl.NumberFormat(INTL_TAG[locale]);
  const name = item.name || t("helperNoName");
  const rate = acceptance(item);
  const m = MOVE[item.status];
  const when = item.status === "pending" ? item.appliedAt : item.decidedAt;
  return (
    <li className={h.card} data-waiting={item.status === "pending" ? "" : undefined}>
      <Monogram name={name} locale={locale} />
      <div className={h.who}>
        <bdi className={h.name}>{name}</bdi>
        <span className={styles.secondary}>
          {[
            item.placeName ? pickText(item.placeName, locale) : null,
            when ? relativeTime(locale, when) : null,
          ]
            .filter(Boolean)
            .map((part, i) => (
              <span key={i}>
                {i ? " · " : ""}
                <bdi>{part}</bdi>
              </span>
            ))}
        </span>
        {item.phone ? (
          <a href={telHref(item.phone)} dir="ltr" className={h.phone}>
            {item.phone}
          </a>
        ) : null}
      </div>
      {item.note ? (
        <p className={h.note} dir="auto">
          {item.note}
        </p>
      ) : null}
      <dl className={h.stats}>
        <dt>{t("helperAdded")}</dt>
        <dd>{t("helperAddedCount", { count: n.format(item.added) })}</dd>
        <dt>{t("helperAcceptance")}</dt>
        <dd className={rate?.low ? h.low : undefined}>
          {rate
            ? t("helperAcceptanceRate", { percent: n.format(rate.percent) })
            : t("helperNoDecisions")}
        </dd>
        {item.credit ? (
          <>
            <dt>{t("helperCreditLabel")}</dt>
            <dd>{t("helperCreditOn")}</dd>
          </>
        ) : null}
      </dl>
      {item.status === "pending" ? null : (
        <LimitPicker
          action={setHelperLimit}
          id={item.id}
          locale={locale}
          current={limitChoice(item.dailyLimit)}
          labels={{
            group: t("helperLimitLabel"),
            hint: t("helperLimitHint"),
            none: t("helperLimitNone"),
            saved: t("helperLimitSaved"),
          }}
        />
      )}
      <div className={h.foot}>
        <ActionButton
          action={decideHelper}
          fields={{ id: item.id, locale, move: m.move }}
          label={t(m.label)}
          className={item.status === "approved" ? styles.ghost : styles.primary}
          icon={<AdminIcon name={m.icon} size={18} />}
          confirm={item.status === "approved" ? t("helperPauseConfirm", { name }) : undefined}
          done={t(m.done)}
        />
        {item.added ? (
          <Link
            href={adminHref(locale, `/join-requests?helper=${item.id}`)}
            className={styles.ghost}
          >
            <AdminIcon name="inbox" size={18} />
            {t("helperSeeAdditions")}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Darb Helpers: who asked to add businesses from their towns (oldest first), who is active and who
 * is paused, with how their additions fared in the review.
 */
export default async function HelpersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const raw = one((await searchParams).status);
  const status = TABS.some(([s]) => s === raw) ? (raw as AdminHelperDto["status"]) : "pending";
  const page = okOr<AdminHelperPageDto>(
    await (await adminApi()).helpers.list({ query: { status } }),
    locale,
  );
  const base = adminHref(locale, "/helpers");
  return (
    <div>
      <PageHead title={at(locale, "navHelpers")} sub={at(locale, "helpersHint")} />
      <StatusTabs
        label={at(locale, "status")}
        tabs={TABS.map(([value, key]) => ({
          href: withParams(base, { status: value === "pending" ? undefined : value }),
          label: at(locale, key),
          current: status === value,
          count: page.counts[value],
        }))}
      />
      {page.items.length === 0 ? (
        <div className={styles.tableWrap}>
          <Empty icon="people" title={at(locale, "helpersEmpty")} />
        </div>
      ) : (
        <ul className={h.list} role="list" data-list="helpers">
          {page.items.map((item) => (
            <Helper key={item.id} locale={locale} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
