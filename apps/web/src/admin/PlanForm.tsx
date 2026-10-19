import type { AdminPlanDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import type { ReactNode } from "react";
import { Check, Section, Segmented } from "./editor-parts";
import { editorLabels } from "./editor-labels";
import { EditorShell } from "./EditorShell";
import { savePlan } from "./actions";
import { at, type AdminKey } from "./copy";
import { LocalizedFields, TextArea, TextField } from "./fields";
import styles from "./admin.module.css";

/** Create and edit a pricing plan. Every word and number on its card comes from here. */
export function PlanForm({
  locale,
  plan,
  after,
}: {
  locale: Locale;
  plan?: AdminPlanDto;
  after?: ReactNode;
}) {
  const t = (key: AdminKey) => at(locale, key);
  const p = plan;
  const langs = [
    ["he", "langHe", "rtl"],
    ["ar", "langAr", "rtl"],
    ["en", "langEn", "ltr"],
  ] as const;
  return (
    <EditorShell
      id="plan-form"
      action={savePlan}
      labels={editorLabels(locale)}
      submit={t(p ? "save" : "create")}
      sections={[
        { id: "names", label: t("secNames") },
        { id: "price", label: t("secPrice") },
        { id: "included", label: t("secIncluded") },
        { id: "button", label: t("secButton") },
        { id: "show", label: t("secShow") },
        ...(after ? [{ id: "advanced", label: t("secAdvanced") }] : []),
      ]}
      after={after}
    >
      <input type="hidden" name="locale" value={locale} />
      <Section id="names" title={t("secNames")}>
        {p ? (
          <input type="hidden" name="id" value={p.id} />
        ) : (
          <TextField
            label={at(locale, "fieldSlug")}
            name="slug"
            dir="ltr"
            required
            hint={at(locale, "fieldSlugHint")}
          />
        )}
        <LocalizedFields
          locale={locale}
          label={at(locale, "fieldName")}
          name="name"
          value={p?.name}
        />
        <LocalizedFields
          locale={locale}
          label={at(locale, "fieldTagline")}
          name="tagline"
          value={p?.tagline}
        />
      </Section>
      <Section id="price" title={t("secPrice")}>
        <div className={styles.row}>
          <TextField
            label={at(locale, "fieldMonthly")}
            name="monthly"
            type="number"
            step="1"
            defaultValue={p ? p.monthly : 0}
            dir="ltr"
            hint={at(locale, "fieldMonthlyHint")}
          />
          <TextField
            label={at(locale, "fieldSetup")}
            name="setup"
            type="number"
            step="1"
            defaultValue={p?.setup}
            dir="ltr"
            hint={at(locale, "fieldSetupHint")}
          />
        </div>
        <LocalizedFields
          locale={locale}
          label={at(locale, "fieldPriceNote")}
          name="priceNote"
          value={p?.priceNote}
        />
      </Section>
      <Section id="included" title={t("secIncluded")}>
        <div className={styles.localized}>
          {langs.map(([l, key, dir]) => (
            <TextArea
              key={l}
              label={`${at(locale, "fieldFeatures")} · ${at(locale, key)}`}
              name={`features.${l}`}
              defaultValue={p?.features[l].join("\n")}
              dir={dir}
              rows={7}
            />
          ))}
        </div>
      </Section>
      <Section id="button" title={t("secButton")}>
        <LocalizedFields
          locale={locale}
          label={at(locale, "fieldCtaLabel")}
          name="ctaLabel"
          value={p?.ctaLabel}
        />
        <TextField
          label={at(locale, "fieldCtaHref")}
          name="ctaHref"
          defaultValue={p?.ctaHref ?? "/contact"}
          dir="ltr"
          required
          hint={at(locale, "fieldCtaHrefHint")}
        />
      </Section>
      <Section id="show" title={t("secShow")}>
        <div className={styles.localized}>
          {langs.map(([l, key, dir]) => (
            <TextArea
              key={l}
              label={`${at(locale, "fieldFinePrint")} · ${at(locale, key)}`}
              name={`finePrint.${l}`}
              defaultValue={p?.finePrint[l]}
              dir={dir}
              rows={3}
            />
          ))}
        </div>
        <Check name="highlighted" label={t("fieldHighlighted")} checked={p?.highlighted === true} />
        <div className={styles.row}>
          <Segmented
            legend={t("status")}
            name="status"
            value={p?.status ?? "hidden"}
            options={[
              ["live", t("statusLive")],
              ["hidden", t("statusHidden")],
            ]}
          />
          <TextField
            label={at(locale, "fieldOrder")}
            name="order"
            type="number"
            defaultValue={p?.order ?? 0}
            dir="ltr"
          />
        </div>
      </Section>
    </EditorShell>
  );
}
