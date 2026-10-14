import { notFound } from "next/navigation";
import type { AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { pickText, TEMPLATES } from "@darb/core";
import { saveKind } from "@/admin/actions";
import { ActionForm } from "@/admin/ActionForm";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { EntityMeta } from "@/admin/EntityMeta";
import { TakedownWarning } from "@/admin/TakedownWarning";
import { one, type SearchParams } from "@/admin/params";
import { LocalizedFields, SelectField, TextArea, TextField } from "@/admin/fields";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function EditKind({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, id } = await params;
  const stale = one((await searchParams).stale) === "1";
  if (!isLocale(locale)) notFound();
  const api = await adminApi();
  const [k, sectors, kinds] = await Promise.all([
    api.kinds.get({ params: { id } }).then((r) => okOr<AdminKindDto>(r, locale)),
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
    api.kinds.list({ query: {} }).then((r) => okOr<AdminKindDto[]>(r, locale)),
  ]);
  const siblings = kinds.filter((x) => x.sectorId === k.sectorId && x.id !== k.id);
  // A kind with sub-kinds stays in its sector (the API refuses the move: kind_has_sub_kinds).
  const hasSubKinds = kinds.some((x) => x.parentKindId === k.id);
  const sector = sectors.find((s) => s.id === k.sectorId);
  return (
    <>
      <h1 className={styles.h1}>{pickText(k.name, locale)}</h1>
      <p className={styles.hint} dir="ltr">
        {k.slug} · {at(locale, "businessesCount", { count: k.businessCount })}
      </p>
      {stale ? <TakedownWarning locale={locale} entity="kind" id={k.id} back="page" /> : null}
      <ActionForm
        action={saveKind}
        submit={at(locale, "save")}
        labels={{ fix: at(locale, "errorFix") }}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={k.id} />
        <LocalizedFields
          locale={locale}
          label={at(locale, "fieldName")}
          name="name"
          value={k.name}
        />
        <div className={styles.row}>
          <TextArea
            label={`${at(locale, "fieldSynonyms")} · ${at(locale, "langHe")}`}
            name="synonyms.he"
            defaultValue={k.synonyms.he.join("\n")}
            dir="rtl"
          />
          <TextArea
            label={`${at(locale, "fieldSynonyms")} · ${at(locale, "langAr")}`}
            name="synonyms.ar"
            defaultValue={k.synonyms.ar.join("\n")}
            dir="rtl"
          />
          <TextArea
            label={`${at(locale, "fieldSynonyms")} · ${at(locale, "langEn")}`}
            name="synonyms.en"
            defaultValue={k.synonyms.en.join("\n")}
            dir="ltr"
          />
        </div>
        <div className={styles.row}>
          {hasSubKinds ? (
            <div className={styles.field}>
              <span>{at(locale, "fieldSector")}</span>
              <input type="hidden" name="sectorId" value={k.sectorId} />
              <strong>{sector ? pickText(sector.name, locale) : k.sectorId}</strong>
              <small className={styles.hint}>{at(locale, "sectorLocked")}</small>
            </div>
          ) : (
            <SelectField
              label={at(locale, "fieldSector")}
              name="sectorId"
              defaultValue={k.sectorId}
              options={sectors.map((s) => [s.id, pickText(s.name, locale)])}
            />
          )}
          <SelectField
            label={at(locale, "fieldParentKind")}
            name="parentKindId"
            defaultValue={k.parentKindId ?? ""}
            allowEmpty={at(locale, "none")}
            options={siblings.map((s) => [s.id, pickText(s.name, locale)])}
          />
          <SelectField
            label={at(locale, "fieldTemplate")}
            name="template"
            defaultValue={k.template}
            options={TEMPLATES.map((t) => [t, t])}
          />
          <SelectField
            label={at(locale, "status")}
            name="status"
            defaultValue={k.status}
            options={[
              ["active", at(locale, "statusActive")],
              ["hidden", at(locale, "statusHidden")],
            ]}
          />
          <TextField
            label={at(locale, "fieldOrder")}
            name="order"
            type="number"
            defaultValue={k.order}
            dir="ltr"
          />
          <TextField label={at(locale, "fieldIcon")} name="icon" defaultValue={k.icon} dir="ltr" />
        </div>
        <TextArea
          label={at(locale, "fieldAttributes")}
          name="attributes"
          defaultValue={k.attributes.join("\n")}
          dir="ltr"
        />
      </ActionForm>
      <EntityMeta locale={locale} entity="kind" id={k.id} editedAt={k.editedAt} />
    </>
  );
}
