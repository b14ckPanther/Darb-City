import { notFound } from "next/navigation";
import { saveSector } from "@/admin/actions";
import { ActionForm } from "@/admin/ActionForm";
import { at } from "@/admin/copy";
import { LocalizedFields, TextField } from "@/admin/fields";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function NewSector({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      <h1 className={styles.h1}>{at(locale, "newSector")}</h1>
      <ActionForm
        action={saveSector}
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
        <LocalizedFields locale={locale} label={at(locale, "fieldTagline")} name="tagline" />
        <div className={styles.row}>
          <TextField
            label={at(locale, "fieldAccent")}
            name="accent"
            defaultValue="#d9a54c"
            dir="ltr"
          />
          <TextField
            label={at(locale, "fieldOrder")}
            name="order"
            type="number"
            defaultValue={0}
            dir="ltr"
          />
        </div>
      </ActionForm>
    </>
  );
}
