import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminPlaceDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { savePlace } from "@/admin/actions";
import { ActionForm } from "@/admin/ActionForm";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { EntityMeta } from "@/admin/EntityMeta";
import { TakedownWarning } from "@/admin/TakedownWarning";
import { one, type SearchParams } from "@/admin/params";
import { LocalizedFields, SelectField, TextArea, TextField } from "@/admin/fields";
import { isLocale } from "@/lib/locale";
import { href } from "@/lib/routes";
import styles from "@/admin/admin.module.css";

export default async function EditPlace({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, id } = await params;
  const stale = one((await searchParams).stale) === "1";
  if (!isLocale(locale)) notFound();
  const p = okOr<AdminPlaceDto>(await (await adminApi()).places.get({ params: { id } }), locale);
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{pickText(p.name, locale)}</h1>
        <Link className={styles.ghost} href={href(locale, [p.slug])} target="_blank" rel="noopener">
          {at(locale, "openPublic")}
        </Link>
      </div>
      <p className={styles.hint} dir="ltr">
        {p.path} · {p.type}
        {p.cbsCode ? ` · CBS ${p.cbsCode}` : ""}
      </p>
      {stale ? <TakedownWarning locale={locale} entity="place" id={p.id} back="page" /> : null}
      <ActionForm
        action={savePlace}
        submit={at(locale, "save")}
        labels={{ fix: at(locale, "errorFix") }}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={p.id} />
        <LocalizedFields
          locale={locale}
          label={at(locale, "fieldName")}
          name="name"
          value={p.name}
        />
        <TextArea
          label={at(locale, "fieldAliases")}
          name="aliases"
          defaultValue={p.aliases.join("\n")}
          dir="auto"
        />
        <div className={styles.row}>
          <TextField
            label={at(locale, "fieldLat")}
            name="lat"
            type="number"
            step="any"
            defaultValue={p.lat}
            dir="ltr"
          />
          <TextField
            label={at(locale, "fieldLng")}
            name="lng"
            type="number"
            step="any"
            defaultValue={p.lng}
            dir="ltr"
          />
          <TextField
            label={at(locale, "fieldPopulation")}
            name="population"
            type="number"
            defaultValue={p.population}
            dir="ltr"
          />
          <SelectField
            label={at(locale, "status")}
            name="status"
            defaultValue={p.status}
            options={[
              ["live", at(locale, "statusLive")],
              ["soon", at(locale, "statusSoon")],
            ]}
          />
        </div>
      </ActionForm>
      <EntityMeta locale={locale} entity="place" id={p.id} editedAt={p.editedAt} />
    </>
  );
}
