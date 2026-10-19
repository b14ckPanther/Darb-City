import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { AdminIcon, type AdminIconName } from "./AdminIcon";
import { at, type AdminKey } from "./copy";
import styles from "./admin.module.css";

/** A page's head: an optional way back, the title, a line under it, and the page's actions. */
export function PageHead({
  title,
  sub,
  back,
  actions,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className={styles.pageHead}>
      <div className={styles.pageTitle}>
        {back ? (
          <Link href={back.href} className={styles.crumb}>
            <AdminIcon name="back" size={16} />
            {back.label}
          </Link>
        ) : null}
        <h1 className={styles.h1}>{title}</h1>
        {sub ? <p className={styles.sub}>{sub}</p> : null}
        {children}
      </div>
      {actions ? <div className={styles.headActions}>{actions}</div> : null}
    </header>
  );
}

const STATUS_KEY: Record<string, AdminKey> = {
  live: "statusLive",
  soon: "statusSoon",
  active: "statusActive",
  hidden: "statusHidden",
  draft: "statusDraft",
  published: "statusPublished",
  suspended: "statusSuspended",
  pending: "joinPending",
  approved: "joinApproved",
  rejected: "joinRejected",
  new: "inquiryNew",
  handled: "inquiryHandled",
};

/** One status: a coloured dot and its word (never colour alone). */
export function Status({ locale, status }: { locale: Locale; status: string }) {
  const key = STATUS_KEY[status];
  return (
    <span className={styles.status} data-status={status}>
      {key ? at(locale, key) : status}
    </span>
  );
}

/**
 * Who owns the row, as a quiet mark: a pencil when an admin edited it (the seed run leaves it
 * alone), nothing when it still follows the seed data.
 */
export function Owner({ locale, editedAt }: { locale: Locale; editedAt: string | null }) {
  if (!editedAt) return null;
  return (
    <span className={styles.owner} title={at(locale, "edited")}>
      <AdminIcon name="edit" size={15} />
      <span className={styles.srOnly}>{at(locale, "edited")}</span>
    </span>
  );
}

export function Empty({
  icon = "inbox",
  title,
  children,
}: {
  icon?: AdminIconName;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.empty} data-empty="">
      <AdminIcon name={icon} size={32} />
      <strong>{title}</strong>
      {children}
    </div>
  );
}

/** A record's first letter on a soft tile, when it has no picture. */
export function Monogram({ name, locale }: { name: string; locale: Locale }) {
  return (
    <span className={styles.thumb} aria-hidden="true">
      {[...name.trim()][0]?.toLocaleUpperCase(locale) ?? "·"}
    </span>
  );
}

/** "1 to 50 of 10,780", and previous / next. Links, so it works without JavaScript. */
export function Pager({
  locale,
  page,
  size,
  total,
  href,
}: {
  locale: Locale;
  page: number;
  size: number;
  total: number;
  href: (page: number) => string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const last = Math.max(1, Math.ceil(total / size));
  const n = numberFormat(locale);
  return (
    <nav className={styles.pager} aria-label={at(locale, "pages")}>
      <span role="status">
        {at(locale, "showing", { from: n.format(from), to: n.format(to), total: n.format(total) })}
      </span>
      <span className={styles.pagerButtons}>
        <Link
          href={href(page - 1)}
          className={`${styles.ghost} ${styles.sm}`}
          aria-disabled={page <= 1 ? "true" : undefined}
          tabIndex={page <= 1 ? -1 : undefined}
          rel="prev"
        >
          <AdminIcon name="back" size={16} />
          {at(locale, "previousPage")}
        </Link>
        <Link
          href={href(page + 1)}
          className={`${styles.ghost} ${styles.sm}`}
          aria-disabled={page >= last ? "true" : undefined}
          tabIndex={page >= last ? -1 : undefined}
          rel="next"
        >
          {at(locale, "nextPage")}
          <AdminIcon name="chevron" size={16} />
        </Link>
      </span>
    </nav>
  );
}

/** Numbers in Latin digits in every language (as the rest of Darb writes them). */
export const numberFormat = (locale: Locale) =>
  new Intl.NumberFormat(locale === "ar" ? "ar-IL-u-nu-latn" : `${locale}-IL`);

/** "3 minutes ago", "yesterday": short and in the admin's language. */
export function relativeTime(locale: Locale, iso: string, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-u-nu-latn" : locale, {
    numeric: "auto",
    style: "short",
  });
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86_400 * 30) return rtf.format(Math.round(s / 86_400), "day");
  if (abs < 86_400 * 365) return rtf.format(Math.round(s / (86_400 * 30)), "month");
  return rtf.format(Math.round(s / (86_400 * 365)), "year");
}

/** Tabs that filter a list by status: links, with the current one marked and optional counts. */
export function StatusTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: { href: string; label: string; current: boolean; count?: number }[];
}) {
  return (
    <nav className={styles.tabs} aria-label={label}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={styles.tabLink}
          aria-current={tab.current ? "page" : undefined}
        >
          {tab.label}
          {tab.count ? <span className={styles.count}>{tab.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
