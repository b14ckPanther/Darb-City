import type { AdminBusinessDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
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
    <form action={setBusinessStatus}>
      <input type="hidden" name="id" value={business.id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className={cls}>
        {label}
      </button>
    </form>
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
          <form action={deleteBusiness}>
            <input type="hidden" name="id" value={business.id} />
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={styles.danger}>
              {at(locale, "deleteDraft")}
            </button>
          </form>
        ) : null}
      </div>
      <p className={styles.hint}>{at(locale, "suspendHint")}</p>
    </section>
  );
}
