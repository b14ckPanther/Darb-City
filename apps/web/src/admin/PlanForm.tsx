import type { AdminPlanDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { ActionForm } from "./ActionForm";
import { savePlan } from "./actions";
import { at } from "./copy";
import { LocalizedFields, SelectField, TextArea, TextField } from "./fields";
import styles from "./admin.module.css";

/** Create and edit a pricing plan. Every word and number on its card comes from here. */
export function PlanForm({ locale, plan }: { locale: Locale; plan?: AdminPlanDto }) {
  const p = plan;
  const langs = [
    ["he", "langHe", "rtl"],
    ["ar", "langAr", "rtl"],
    ["en", "langEn", "ltr"],
  ] as const;
  return (
    <ActionForm
      action={savePlan}
      submit={at(locale, p ? "save" : "create")}
      labels={{ fix: at(locale, "errorFix") }}
    >
      <input type="hidden" name="locale" value={locale} />
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
      <div className={styles.row}>
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
      <div className={styles.row}>
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
      <label className={styles.actions}>
        <input
          type="checkbox"
          name="highlighted"
          defaultChecked={p?.highlighted === true}
          style={{ inlineSize: 24, blockSize: 24 }}
        />
        {at(locale, "fieldHighlighted")}
      </label>
      <div className={styles.row}>
        <SelectField
          label={at(locale, "status")}
          name="status"
          defaultValue={p?.status ?? "hidden"}
          options={[
            ["live", at(locale, "statusLive")],
            ["hidden", at(locale, "statusHidden")],
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
    </ActionForm>
  );
}
