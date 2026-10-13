import type { Locale } from "@darb/core";
import { at, type AdminKey } from "./copy";
import styles from "./admin.module.css";

const STATUS: Record<string, AdminKey> = {
  live: "statusLive",
  soon: "statusSoon",
  active: "statusActive",
  hidden: "statusHidden",
  draft: "statusDraft",
  published: "statusPublished",
  suspended: "statusSuspended",
};
const GOLD = new Set(["live", "active", "published"]);

export function StatusBadge({ locale, status }: { locale: Locale; status: keyof typeof STATUS }) {
  return (
    <span className={GOLD.has(status) ? `${styles.badge} ${styles.badgeGold}` : styles.badge}>
      {at(locale, STATUS[status]!)}
    </span>
  );
}

export function OwnerBadge({ locale, editedAt }: { locale: Locale; editedAt: string | null }) {
  return <span className={styles.badge}>{at(locale, editedAt ? "edited" : "seedOwned")}</span>;
}
