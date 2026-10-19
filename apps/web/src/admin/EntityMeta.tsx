import type { AdminEntity, AuditRowDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { adminApi, okOr } from "./api";
import { ActionButton } from "./ActionButton";
import { releaseEntity } from "./actions";
import { AdminIcon } from "./AdminIcon";
import { at, type AdminKey } from "./copy";
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
  const t = (key: AdminKey) => at(locale, key);
  return (
    <div className={styles.meta} data-entity-meta="">
      <div className={styles.ownerLine}>
        <AdminIcon name={editedAt ? "edit" : "sparkle"} size={18} />
        <div>
          <strong>{t(editedAt ? "edited" : "seedOwned")}</strong>
          <p className={styles.hint}>{t(editedAt ? "editedHint" : "seedOwnedHint")}</p>
        </div>
      </div>
      {editedAt && seedSource ? (
        <ActionButton
          action={releaseEntity}
          fields={{ locale, entity, id }}
          label={t("release")}
          className={`${styles.ghost} ${styles.sm}`}
          confirm={t("releaseConfirm")}
          done={t("releaseDone")}
        >
          <small className={styles.hint}>{t("releaseHint")}</small>
        </ActionButton>
      ) : null}
      <h3 id={`history-${id}`} className={styles.h3}>
        {t("history")}
      </h3>
      {audit.length === 0 ? (
        <p className={styles.muted}>{t("historyEmpty")}</p>
      ) : (
        <ol className={styles.timeline} aria-labelledby={`history-${id}`}>
          {audit.map((a) => (
            <li key={a.id}>
              <span className={styles.timelineDot} data-action={a.action} aria-hidden="true" />
              <div>
                <span>
                  {t(ACTION[a.action] ?? "actUpdate")}
                  {a.fields.length && a.action !== "status" ? (
                    <span className={styles.muted}>
                      {" "}
                      · {a.fields.map((f) => fieldName(locale, f)).join(", ")}
                    </span>
                  ) : null}
                </span>
                <span className={styles.secondary}>
                  <time dateTime={a.at}>{when.format(new Date(a.at))}</time> ·{" "}
                  <bdi dir="ltr">{a.actor}</bdi>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const ACTION: Record<string, AdminKey> = {
  create: "histCreate",
  update: "histUpdate",
  status: "histStatus",
  release: "histRelease",
  delete: "histDelete",
};
/** A changed field's name in words when the admin copy has one; the code otherwise. */
function fieldName(locale: Locale, field: string): string {
  const key = FIELD[field];
  return key ? at(locale, key) : field;
}
const FIELD: Record<string, AdminKey> = {
  name: "fieldName",
  tagline: "fieldTagline",
  address: "fieldAddress",
  phone: "fieldPhone",
  whatsapp: "fieldWhatsapp",
  website: "fieldWebsite",
  hours: "secHours",
  links: "fieldLinks",
  lat: "fieldLocation",
  lng: "fieldLocation",
  tier: "fieldTier",
  primaryKindId: "fieldPrimaryKind",
  kindIds: "fieldKinds",
  photos: "fieldPhotos",
  logo: "fieldLogo",
  cardStyle: "fieldCardStyle",
  synonyms: "fieldWords",
  status: "status",
};
