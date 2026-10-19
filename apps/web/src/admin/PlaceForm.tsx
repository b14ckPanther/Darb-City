import type { AdminPlaceDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import type { ReactNode } from "react";
import { savePlace } from "./actions";
import { at, type AdminKey } from "./copy";
import { Section, Segmented } from "./editor-parts";
import { editorLabels } from "./editor-labels";
import { EditorShell } from "./EditorShell";
import { LocalizedFields, TextArea, TextField } from "./fields";
import { PLACE_TYPE_KEY } from "./labels";
import { pinLabels } from "./pin-labels";
import { PointField } from "./PointField";
import styles from "./admin.module.css";

/** A place: its names and spellings, its centre on the map, and whether it is live. */
export function PlaceForm({
  locale,
  place: p,
  after,
}: {
  locale: Locale;
  place?: AdminPlaceDto;
  after?: ReactNode;
}) {
  const t = (key: AdminKey) => at(locale, key);
  return (
    <EditorShell
      id="place-form"
      action={savePlace}
      labels={editorLabels(locale)}
      submit={t(p ? "save" : "create")}
      sections={[
        { id: "names", label: t("secNames") },
        { id: "where", label: t("secLocation") },
        { id: "details", label: t("secDetails") },
        ...(after ? [{ id: "advanced", label: t("secAdvanced") }] : []),
      ]}
      after={after}
    >
      <input type="hidden" name="locale" value={locale} />
      {p ? <input type="hidden" name="id" value={p.id} /> : null}
      <Section id="names" title={t("secNames")} hint={t("secNamesHint")}>
        <LocalizedFields locale={locale} label={t("fieldName")} name="name" value={p?.name} />
        <TextArea
          label={t("fieldAliases")}
          name="aliases"
          defaultValue={p?.aliases.join("\n")}
          dir="auto"
          rows={3}
        />
        {p ? null : (
          <div className={styles.row}>
            <TextField
              label={t("fieldSlug")}
              name="slug"
              dir="ltr"
              required
              hint={t("fieldSlugHint")}
            />
            <TextField
              label={t("fieldParent")}
              name="parent"
              dir="ltr"
              required
              hint={t("fieldParentHint")}
            />
          </div>
        )}
      </Section>
      <Section id="where" title={t("secLocation")} hint={t("placeCentreHint")}>
        <PointField
          locale={locale}
          value={p ? { lat: p.lat, lng: p.lng } : null}
          labels={pinLabels(locale)}
        />
      </Section>
      <Section id="details" title={t("secDetails")}>
        <Segmented
          legend={t("status")}
          name="status"
          value={p?.status ?? "soon"}
          options={[
            ["live", t("statusLive")],
            ["soon", t("statusSoon")],
          ]}
          hint={t("placeStatusHint")}
        />
        {p ? (
          <p className={styles.hint}>
            {t("fieldType")}: {t(PLACE_TYPE_KEY[p.type])}
            {p.cbsCode ? ` · ${t("cbsCode")} ${p.cbsCode}` : ""}
          </p>
        ) : (
          <Segmented
            legend={t("fieldType")}
            name="type"
            value="neighbourhood"
            options={(["neighbourhood", "village", "town", "city", "region"] as const).map((x) => [
              x,
              t(PLACE_TYPE_KEY[x]),
            ])}
          />
        )}
        <div className={styles.row}>
          <TextField
            label={t("fieldPopulation")}
            name="population"
            type="number"
            defaultValue={p?.population}
            dir="ltr"
          />
        </div>
      </Section>
    </EditorShell>
  );
}
