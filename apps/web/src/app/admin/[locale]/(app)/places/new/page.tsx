import { notFound } from "next/navigation";
import { savePlace } from "@/admin/actions";
import { ActionForm } from "@/admin/ActionForm";
import { at } from "@/admin/copy";
import { LocalizedFields, SelectField, TextArea, TextField } from "@/admin/fields";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function NewPlace({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      <h1 className={styles.h1}>{at(locale, "newPlace")}</h1>
      <ActionForm
        action={savePlace}
        submit={at(locale, "create")}
        labels={{ fix: at(locale, "errorFix") }}
      >
        <input type="hidden" name="locale" value={locale} />
        <div className={styles.row}>
          <TextField
            label={at(locale, "fieldSlug")}
            name="slug"
            dir="ltr"
            required
            hint={at(locale, "fieldSlugHint")}
          />
          <TextField label={at(locale, "fieldParent")} name="parent" dir="ltr" required />
          <SelectField
            label={at(locale, "fieldType")}
            name="type"
            defaultValue="neighbourhood"
            options={[
              ["neighbourhood", "neighbourhood"],
              ["village", "village"],
              ["town", "town"],
              ["city", "city"],
              ["region", "region"],
            ]}
          />
        </div>
        <LocalizedFields locale={locale} label={at(locale, "fieldName")} name="name" />
        <TextArea label={at(locale, "fieldAliases")} name="aliases" dir="auto" />
        <div className={styles.row}>
          <TextField
            label={at(locale, "fieldLat")}
            name="lat"
            type="number"
            step="any"
            dir="ltr"
            required
          />
          <TextField
            label={at(locale, "fieldLng")}
            name="lng"
            type="number"
            step="any"
            dir="ltr"
            required
          />
          <TextField
            label={at(locale, "fieldPopulation")}
            name="population"
            type="number"
            dir="ltr"
          />
          <SelectField
            label={at(locale, "status")}
            name="status"
            defaultValue="soon"
            options={[
              ["soon", at(locale, "statusSoon")],
              ["live", at(locale, "statusLive")],
            ]}
          />
        </div>
      </ActionForm>
    </>
  );
}
