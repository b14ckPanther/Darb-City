import type { ReactNode } from "react";
import type { AdminSectorDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { saveSector } from "./actions";
import { at, type AdminKey } from "./copy";
import { Section } from "./editor-parts";
import { editorLabels } from "./editor-labels";
import { EditorShell } from "./EditorShell";
import { LocalizedFields, TextField } from "./fields";
import styles from "./admin.module.css";

/** A category: its names and line, its colour on the city, and its place in the order. */
export function SectorForm({
  locale,
  sector: s,
  after,
}: {
  locale: Locale;
  sector?: AdminSectorDto;
  after?: ReactNode;
}) {
  const t = (key: AdminKey) => at(locale, key);
  return (
    <EditorShell
      id="sector-form"
      action={saveSector}
      labels={editorLabels(locale)}
      submit={t(s ? "save" : "create")}
      sections={[
        { id: "names", label: t("secNames") },
        { id: "look", label: t("secLook") },
        ...(after ? [{ id: "advanced", label: t("secAdvanced") }] : []),
      ]}
      after={after}
    >
      <input type="hidden" name="locale" value={locale} />
      {s ? <input type="hidden" name="id" value={s.id} /> : null}
      <Section id="names" title={t("secNames")}>
        {s ? null : (
          <TextField
            label={t("fieldSlug")}
            name="slug"
            dir="ltr"
            required
            hint={t("fieldSlugHint")}
          />
        )}
        <LocalizedFields locale={locale} label={t("fieldName")} name="name" value={s?.name} />
        <LocalizedFields
          locale={locale}
          label={t("fieldTagline")}
          name="tagline"
          value={s?.tagline}
        />
      </Section>
      <Section id="look" title={t("secLook")}>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>{t("fieldAccent")}</span>
            <input
              type="color"
              name="accent"
              defaultValue={s?.accent ?? "#d9a54c"}
              className={styles.colorInput}
            />
          </label>
          <TextField
            label={t("fieldOrder")}
            name="order"
            type="number"
            defaultValue={s?.order ?? 0}
            dir="ltr"
            hint={t("fieldOrderHint")}
          />
        </div>
      </Section>
    </EditorShell>
  );
}
