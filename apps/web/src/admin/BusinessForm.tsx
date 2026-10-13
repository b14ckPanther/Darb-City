import type { AdminBusinessDto, AdminKindDto } from "@darb/contracts";
import { pickText, TIERS, type Locale } from "@darb/core";
import { ActionForm } from "./ActionForm";
import { saveBusiness } from "./business-actions";
import { EMPTY_EXPERIENCE } from "./business-form";
import { at } from "./copy";
import { LocalizedFields, SelectField, TextArea, TextField } from "./fields";
import { exceptionsToText } from "./hours-form";
import { HoursEditor } from "./HoursEditor";
import styles from "./admin.module.css";

export function BusinessForm({
  locale,
  kinds,
  business,
}: {
  locale: Locale;
  kinds: AdminKindDto[];
  business?: AdminBusinessDto;
}) {
  const b = business;
  const kindSlug = new Map(kinds.map((k) => [k.id, k.slug]));
  const { delivers: _d, ...otherAttributes } = b?.attributes ?? {};
  const days = (["day0", "day1", "day2", "day3", "day4", "day5", "day6"] as const).map((d) =>
    at(locale, d),
  );
  return (
    <ActionForm
      action={saveBusiness}
      submit={at(locale, b ? "save" : "create")}
      labels={{ fix: at(locale, "errorFix") }}
    >
      <input type="hidden" name="locale" value={locale} />
      {b ? <input type="hidden" name="id" value={b.id} /> : null}
      {b ? null : (
        <div className={styles.row}>
          <TextField
            label={at(locale, "fieldSlug")}
            name="slug"
            dir="ltr"
            required
            hint={at(locale, "fieldSlugHint")}
          />
          <TextField label={at(locale, "fieldPlace")} name="place" dir="ltr" required />
        </div>
      )}
      <LocalizedFields
        locale={locale}
        label={at(locale, "fieldName")}
        name="name"
        value={b?.name}
      />
      <LocalizedFields
        locale={locale}
        label={at(locale, "fieldTagline")}
        name="tagline"
        value={b?.tagline}
      />
      <LocalizedFields
        locale={locale}
        label={at(locale, "fieldAddress")}
        name="address"
        value={b?.address}
      />
      <div className={styles.row}>
        <SelectField
          label={at(locale, "fieldPrimaryKind")}
          name="primaryKindId"
          defaultValue={b?.primaryKindId}
          options={kinds.map((k) => [k.id, `${pickText(k.name, locale)} (${k.slug})`])}
        />
        <TextArea
          label={at(locale, "fieldKinds")}
          name="kinds"
          dir="ltr"
          rows={2}
          defaultValue={(b?.kindIds ?? [])
            .filter((id) => id !== b?.primaryKindId)
            .map((id) => kindSlug.get(id) ?? "")
            .join("\n")}
        />
        <TextField
          label={at(locale, "fieldLat")}
          name="lat"
          type="number"
          step="any"
          defaultValue={b?.lat}
          dir="ltr"
          required
        />
        <TextField
          label={at(locale, "fieldLng")}
          name="lng"
          type="number"
          step="any"
          defaultValue={b?.lng}
          dir="ltr"
          required
        />
      </div>
      <div className={styles.row}>
        <TextField
          label={at(locale, "fieldPhone")}
          name="phone"
          type="tel"
          defaultValue={b?.phone}
          dir="ltr"
        />
        <TextField
          label={at(locale, "fieldWhatsapp")}
          name="whatsapp"
          type="tel"
          defaultValue={b?.whatsapp}
          dir="ltr"
        />
        <TextField
          label={at(locale, "fieldWebsite")}
          name="website"
          type="url"
          defaultValue={b?.website}
          dir="ltr"
        />
        {b?.tier === "example" ? (
          <div className={styles.field}>
            <span>{at(locale, "fieldTier")}</span>
            <strong dir="ltr">example</strong>
            <small className={styles.hint}>{at(locale, "tierFixed")}</small>
          </div>
        ) : (
          // Real businesses never become showroom examples (the API refuses example_tier_fixed).
          <SelectField
            label={at(locale, "fieldTier")}
            name="tier"
            defaultValue={b?.tier ?? "basic"}
            options={TIERS.filter((t) => t !== "example").map((t) => [t, t])}
          />
        )}
      </div>
      <fieldset className={styles.row} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className={styles.hint}>{at(locale, "fieldApps")}</legend>
        <TextField
          label={at(locale, "fieldAppWeb")}
          name="apps.web"
          type="url"
          defaultValue={b?.apps.web}
          dir="ltr"
        />
        <TextField
          label={at(locale, "fieldAppIos")}
          name="apps.ios"
          type="url"
          defaultValue={b?.apps.ios}
          dir="ltr"
        />
        <TextField
          label={at(locale, "fieldAppAndroid")}
          name="apps.android"
          type="url"
          defaultValue={b?.apps.android}
          dir="ltr"
        />
      </fieldset>
      <h2 className={styles.h2}>{at(locale, "fieldHours")}</h2>
      <HoursEditor
        weekly={b?.hours.weekly ?? {}}
        labels={{
          days,
          closed: at(locale, "closed"),
          add: at(locale, "addHours"),
          remove: at(locale, "remove"),
          open: at(locale, "opens"),
          close: at(locale, "closes"),
        }}
      />
      <TextArea
        label={at(locale, "fieldExceptions")}
        name="hours.exceptions"
        dir="ltr"
        defaultValue={exceptionsToText(b?.hours.exceptions ?? [])}
      />
      <input type="hidden" name="attributes.base" value={JSON.stringify(otherAttributes)} />
      <label className={styles.actions}>
        <input
          type="checkbox"
          name="delivers"
          defaultChecked={b?.attributes.delivers === true}
          style={{ inlineSize: 24, blockSize: 24 }}
        />
        {at(locale, "fieldDelivers")}
      </label>
      <div className={styles.field}>
        <label className={styles.actions}>
          <input
            type="checkbox"
            name="glutenFree"
            defaultChecked={b?.dietary.includes("gluten_free") === true}
            aria-describedby="glutenFree-hint"
            style={{ inlineSize: 24, blockSize: 24 }}
          />
          {at(locale, "fieldGlutenFree")}
        </label>
        <small id="glutenFree-hint" className={styles.hint}>
          {at(locale, "fieldGlutenFreeHint")}
        </small>
      </div>
      <TextArea
        label={at(locale, "fieldExperience")}
        name="experience"
        dir="ltr"
        rows={14}
        defaultValue={JSON.stringify(b?.experience ?? EMPTY_EXPERIENCE, null, 2)}
      />
    </ActionForm>
  );
}
