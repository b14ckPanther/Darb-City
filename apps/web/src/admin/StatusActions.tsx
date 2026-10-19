import type { AdminBusinessDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { AdminIcon } from "./AdminIcon";
import { ActionButton } from "./ActionButton";
import { deleteBusiness, setBusinessStatus } from "./business-actions";
import { at } from "./copy";
import { TakedownWarning } from "./TakedownWarning";
import styles from "./admin.module.css";

/**
 * Publish, back to draft, suspend now (an immediate takedown), and delete an admin draft: in the
 * page head, so the status is changed where it is read. Takedowns ask first.
 */
export function StatusActions({
  locale,
  business,
  stale = false,
}: {
  locale: Locale;
  business: AdminBusinessDto;
  /** The last takedown was saved but the web did not confirm it dropped the public pages. */
  stale?: boolean;
}) {
  const s = business.status;
  const fields = (status: string) => ({ id: business.id, status, locale });
  return (
    <>
      {s !== "published" ? (
        <ActionButton
          action={setBusinessStatus}
          fields={fields("published")}
          label={at(locale, "publish")}
          className={styles.primary}
          icon={<AdminIcon name="check" size={18} />}
          done={at(locale, "donePublished")}
        />
      ) : null}
      {s !== "draft" ? (
        <ActionButton
          action={setBusinessStatus}
          fields={fields("draft")}
          label={at(locale, "toDraft")}
          className={styles.ghost}
          icon={<AdminIcon name="undo" size={18} />}
          confirm={s === "published" ? at(locale, "confirmToDraft") : undefined}
          done={at(locale, "doneDraft")}
        />
      ) : null}
      {s !== "suspended" ? (
        <ActionButton
          action={setBusinessStatus}
          fields={fields("suspended")}
          label={at(locale, "suspend")}
          className={styles.danger}
          confirm={at(locale, "confirmSuspend")}
          done={at(locale, "doneSuspended")}
        />
      ) : null}
      {business.source === "admin" && s === "draft" ? (
        <ActionButton
          action={deleteBusiness}
          fields={{ id: business.id, locale }}
          label={at(locale, "deleteDraft")}
          className={styles.danger}
          icon={<AdminIcon name="trash" size={18} />}
          confirm={at(locale, "confirmDelete")}
        />
      ) : null}
      {stale ? (
        <div className={styles.headWide}>
          <TakedownWarning locale={locale} entity="business" id={business.id} back="page" />
        </div>
      ) : null}
    </>
  );
}
