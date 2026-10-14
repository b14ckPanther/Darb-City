import { notFound } from "next/navigation";
import type { AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { saveSector } from "@/admin/actions";
import { ActionForm } from "@/admin/ActionForm";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { EntityMeta } from "@/admin/EntityMeta";
import { LocalizedFields, TextField } from "@/admin/fields";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function EditSector({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const s = okOr<AdminSectorDto[]>(await (await adminApi()).sectors.list(), locale).find(
    (x) => x.id === id,
  );
  if (!s) notFound();
  return (
    <>
      <h1 className={styles.h1}>{pickText(s.name, locale)}</h1>
      <ActionForm
        action={saveSector}
        submit={at(locale, "save")}
        labels={{ fix: at(locale, "errorFix") }}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={s.id} />
        <LocalizedFields
          locale={locale}
          label={at(locale, "fieldName")}
          name="name"
          value={s.name}
        />
        <LocalizedFields
          locale={locale}
          label={at(locale, "fieldTagline")}
          name="tagline"
          value={s.tagline}
        />
        <div className={styles.row}>
          <TextField
            label={at(locale, "fieldAccent")}
            name="accent"
            defaultValue={s.accent}
            dir="ltr"
          />
          <TextField
            label={at(locale, "fieldOrder")}
            name="order"
            type="number"
            defaultValue={s.order}
            dir="ltr"
          />
        </div>
      </ActionForm>
      <EntityMeta
        locale={locale}
        entity="sector"
        id={s.id}
        editedAt={s.editedAt}
        seedSource={s.seedSource}
      />
    </>
  );
}
