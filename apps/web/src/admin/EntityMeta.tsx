import type { AdminEntity, AuditRowDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { adminApi, okOr } from "./api";
import { ActionButton } from "./ActionButton";
import { releaseEntity } from "./actions";
import { OwnerBadge } from "./Badges";
import { at } from "./copy";
import styles from "./admin.module.css";

/**
 * Who owns the row (seed or admin), "Return to seed data", and the audit trail. The button only
 * shows for an edited row that has seed data behind it: an admin-created row has nothing to return
 * to (the API refuses it with no_seed_source).
 */
export async function EntityMeta({
  locale,
  entity,
  id,
  editedAt,
  seedSource,
}: {
  locale: Locale;
  entity: AdminEntity;
  id: string;
  editedAt: string | null;
  seedSource: boolean;
}) {
  const audit = okOr<AuditRowDto[]>(
    await (await adminApi()).misc.audit({ query: { entityType: entity, entityId: id } }),
    locale,
  );
  const when = new Intl.DateTimeFormat(locale === "ar" ? "ar-IL-u-nu-latn" : `${locale}-IL`, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  });
  return (
    <section className={styles.card} aria-labelledby="history">
      <p>
        <OwnerBadge locale={locale} editedAt={editedAt} />
      </p>
      {editedAt && seedSource ? (
        <ActionButton
          action={releaseEntity}
          fields={{ locale, entity, id }}
          label={at(locale, "release")}
          className={styles.ghost}
        >
          <small className={styles.hint}>{at(locale, "releaseHint")}</small>
        </ActionButton>
      ) : null}
      <h2 id="history" className={styles.h2}>
        {at(locale, "history")}
      </h2>
      {audit.length === 0 ? (
        <p>{at(locale, "historyEmpty")}</p>
      ) : (
        <ul className={styles.plain}>
          {audit.map((a) => (
            <li key={a.id}>
              {when.format(new Date(a.at))} · <bdi dir="ltr">{a.actor}</bdi> · {a.action}
              {a.fields.length ? ` · ${a.fields.join(", ")}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
