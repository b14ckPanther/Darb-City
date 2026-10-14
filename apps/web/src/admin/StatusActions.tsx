import type { AdminBusinessDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { ActionButton } from "./ActionButton";
import { deleteBusiness, setBusinessStatus } from "./business-actions";
import { at } from "./copy";
import styles from "./admin.module.css";

/** Publish, suspend now (an immediate takedown), back to draft, and delete for admin drafts. */
export function StatusActions({
  locale,
  business,
}: {
  locale: Locale;
  business: AdminBusinessDto;
}) {
  const button = (status: "published" | "suspended" | "draft", label: string, cls: string) => (
    <ActionButton
      action={setBusinessStatus}
      fields={{ id: business.id, status, locale }}
      label={label}
      className={cls}
    />
  );
  return (
    <section className={styles.card} aria-label={at(locale, "status")}>
      <div className={styles.actions}>
        {business.status !== "published"
          ? button("published", at(locale, "publish"), styles.primary!)
          : null}
        {business.status !== "suspended"
          ? button("suspended", at(locale, "suspend"), styles.danger!)
          : null}
        {business.status === "published"
          ? button("draft", at(locale, "toDraft"), styles.ghost!)
          : null}
        {business.source === "admin" && business.status === "draft" ? (
          <ActionButton
            action={deleteBusiness}
            fields={{ id: business.id, locale }}
            label={at(locale, "deleteDraft")}
            className={styles.danger}
          />
        ) : null}
      </div>
      <p className={styles.hint}>{at(locale, "suspendHint")}</p>
    </section>
  );
}
