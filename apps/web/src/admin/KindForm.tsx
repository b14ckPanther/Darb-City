import type { ReactNode } from "react";
import type { AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { pickText, TEMPLATES, type Locale } from "@darb/core";
import { saveKind } from "./actions";
import { at, type AdminKey } from "./copy";
import { Section, Segmented } from "./editor-parts";
import { editorLabels } from "./editor-labels";
import { EditorShell } from "./EditorShell";
import { LocalizedFields, SelectField, TextArea, TextField } from "./fields";
import { TEMPLATE_KEY } from "./labels";
import styles from "./admin.module.css";

/** A kind: its names, the words people search with, where it sits, and how its pages work. */
export function KindForm({
  locale,
  kind: k,
  sectors,
  kinds,
  initialName,
  after,
}: {
  locale: Locale;
  kind?: AdminKindDto;
  sectors: AdminSectorDto[];
  kinds: AdminKindDto[];
  /** A new kind named after a search gap. */
  initialName?: string;
  after?: ReactNode;
}) {
  const t = (key: AdminKey) => at(locale, key);
  // A kind with sub-kinds stays in its sector (the API refuses the move: kind_has_sub_kinds).
  const hasSubKinds = k ? kinds.some((x) => x.parentKindId === k.id) : false;
  const sector = sectors.find((s) => s.id === k?.sectorId);
  const parents = kinds.filter((x) => x.id !== k?.id && (!k || x.sectorId === k.sectorId));
  const gap = initialName?.trim().slice(0, 80);
  const gapLang = gap ? (/[֐-׿]/.test(gap) ? "he" : /[؀-ۿ]/.test(gap) ? "ar" : "en") : null;
  const name = k?.name ?? (gap && gapLang ? { [gapLang]: gap } : undefined);
  const words = (l: "he" | "ar" | "en") =>
    k ? k.synonyms[l].join("\n") : gap && gapLang === l ? gap : "";
  return (
    <EditorShell
      id="kind-form"
      action={saveKind}
      labels={editorLabels(locale)}
      submit={t(k ? "save" : "create")}
      sections={[
        { id: "names", label: t("secNames") },
        { id: "words", label: t("secWords") },
        { id: "place", label: t("secKindPlace") },
        ...(after ? [{ id: "advanced", label: t("secAdvanced") }] : []),
      ]}
      after={after}
    >
      <input type="hidden" name="locale" value={locale} />
      {k ? <input type="hidden" name="id" value={k.id} /> : null}
      <Section id="names" title={t("secNames")}>
        <LocalizedFields locale={locale} label={t("fieldName")} name="name" value={name} />
        {k ? (
          <Segmented
            legend={t("status")}
            name="status"
            value={k.status}
            options={[
              ["active", t("statusActive")],
              ["hidden", t("statusHidden")],
            ]}
            hint={t("kindStatusHint")}
          />
        ) : (
          <TextField
            label={t("fieldSlug")}
            name="slug"
            dir="ltr"
            required
            hint={t("fieldSlugHint")}
          />
        )}
      </Section>
      <Section id="words" title={t("secWords")} hint={t("secWordsHint")}>
        <div className={styles.localized}>
          {(
            [
              ["he", "langHe", "rtl"],
              ["ar", "langAr", "rtl"],
              ["en", "langEn", "ltr"],
            ] as const
          ).map(([l, key, dir]) => (
            <TextArea
              key={l}
              label={`${t("fieldSynonyms")} · ${t(key)}`}
              name={`synonyms.${l}`}
              defaultValue={words(l)}
              dir={dir}
              rows={6}
            />
          ))}
        </div>
      </Section>
      <Section id="place" title={t("secKindPlace")}>
        <div className={styles.row}>
          {hasSubKinds && k ? (
            <div className={styles.field}>
              <span className={styles.label}>{t("fieldSector")}</span>
              <input type="hidden" name="sectorId" value={k.sectorId} />
              <strong>{sector ? pickText(sector.name, locale) : ""}</strong>
              <small className={styles.hint}>{t("sectorLocked")}</small>
            </div>
          ) : (
            <SelectField
              label={t("fieldSector")}
              name="sectorId"
              defaultValue={k?.sectorId}
              options={sectors.map((s) => [s.id, pickText(s.name, locale)])}
            />
          )}
          <SelectField
            label={t("fieldParentKind")}
            name="parentKindId"
            defaultValue={k?.parentKindId ?? ""}
            allowEmpty={t("none")}
            options={parents
              .map((s): [string, string] => [s.id, pickText(s.name, locale)])
              .sort((a, b) => a[1].localeCompare(b[1], locale))}
          />
          <SelectField
            label={t("fieldTemplate")}
            name="template"
            defaultValue={k?.template}
            options={TEMPLATES.map((x) => [x, t(TEMPLATE_KEY[x])])}
          />
          <TextField
            label={t("fieldOrder")}
            name="order"
            type="number"
            defaultValue={k?.order ?? 0}
            dir="ltr"
          />
          <TextField label={t("fieldIcon")} name="icon" defaultValue={k?.icon} dir="ltr" />
        </div>
        <TextArea
          label={t("fieldAttributes")}
          name="attributes"
          defaultValue={k?.attributes.join("\n")}
          dir="ltr"
          rows={3}
        />
      </Section>
    </EditorShell>
  );
}
