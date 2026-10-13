import { notFound } from "next/navigation";
import type { AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { pickText, TEMPLATES } from "@darb/core";
import { saveKind } from "@/admin/actions";
import { ActionForm } from "@/admin/ActionForm";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { LocalizedFields, SelectField, TextArea, TextField } from "@/admin/fields";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

/** New kinds start hidden (the API sets it; the form has no status): review, then make it active. */
export default async function NewKind({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const api = await adminApi();
  const [sectors, kinds] = await Promise.all([
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
    api.kinds.list({ query: {} }).then((r) => okOr<AdminKindDto[]>(r, locale)),
  ]);
  return (
    <>
      <h1 className={styles.h1}>{at(locale, "newKind")}</h1>
      <p className={styles.notice}>{at(locale, "kindsHiddenHint")}</p>
      <ActionForm
        action={saveKind}
        submit={at(locale, "create")}
        labels={{ fix: at(locale, "errorFix") }}
      >
        <input type="hidden" name="locale" value={locale} />
        <TextField
          label={at(locale, "fieldSlug")}
          name="slug"
          dir="ltr"
          required
          hint={at(locale, "fieldSlugHint")}
        />
        <LocalizedFields locale={locale} label={at(locale, "fieldName")} name="name" />
        <div className={styles.row}>
          <TextArea
            label={`${at(locale, "fieldSynonyms")} · ${at(locale, "langHe")}`}
            name="synonyms.he"
            dir="rtl"
          />
          <TextArea
            label={`${at(locale, "fieldSynonyms")} · ${at(locale, "langAr")}`}
            name="synonyms.ar"
            dir="rtl"
          />
          <TextArea
            label={`${at(locale, "fieldSynonyms")} · ${at(locale, "langEn")}`}
            name="synonyms.en"
            dir="ltr"
          />
        </div>
        <div className={styles.row}>
          <SelectField
            label={at(locale, "fieldSector")}
            name="sectorId"
            options={sectors.map((s) => [s.id, pickText(s.name, locale)])}
          />
          <SelectField
            label={at(locale, "fieldParentKind")}
            name="parentKindId"
            defaultValue=""
            allowEmpty={at(locale, "none")}
            options={kinds.map((s) => [s.id, `${pickText(s.name, locale)} (${s.slug})`])}
          />
          <SelectField
            label={at(locale, "fieldTemplate")}
            name="template"
            options={TEMPLATES.map((t) => [t, t])}
          />
          <TextField
            label={at(locale, "fieldOrder")}
            name="order"
            type="number"
            defaultValue={0}
            dir="ltr"
          />
          <TextField label={at(locale, "fieldIcon")} name="icon" dir="ltr" />
        </div>
        <TextArea label={at(locale, "fieldAttributes")} name="attributes" dir="ltr" />
      </ActionForm>
    </>
  );
}
