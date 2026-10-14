import type { AdminEntity } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { ActionButton } from "./ActionButton";
import { retryTakedown } from "./actions";
import { at } from "./copy";
import styles from "./admin.module.css";

/**
 * A takedown was saved and left search, but the web did not confirm it dropped the cached public
 * pages (unreachable, a mismatched REVALIDATE_SECRET, or slower than the API waits). Never shown
 * as success: the admin sees it and can ask again.
 */
export function TakedownWarning({
  locale,
  entity,
  id,
  back,
}: {
  locale: Locale;
  entity: AdminEntity;
  id: string;
  /** Where a confirmed retry returns: the entity's page, or the list after a delete. */
  back: "page" | "list";
}) {
  return (
    <section role="alert" className={styles.warning} data-takedown-stale>
      <p>{at(locale, "takedownStale")}</p>
      <ActionButton
        action={retryTakedown}
        fields={{ locale, entity, id, back }}
        label={at(locale, "retry")}
        className={styles.primary}
      />
    </section>
  );
}
