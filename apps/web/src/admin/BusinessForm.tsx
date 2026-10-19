import type { ReactNode } from "react";
import type { AdminBusinessDto, AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { CARD_ACCENTS, pickText, TIERS, type Locale } from "@darb/core";
import { card as cardCopy } from "@/content/card";
import { MEDIA_ORIGIN } from "@/lib/csp";
import { saveBusiness } from "./business-actions";
import { BusinessLocation } from "./BusinessLocation";
import { EMPTY_EXPERIENCE } from "./business-form";
import { at, type AdminKey } from "./copy";
import { Check, Section, Segmented, SubHead, Swatches } from "./editor-parts";
import { editorLabels } from "./editor-labels";
import { EditorShell } from "./EditorShell";
import { LocalizedFields, TextArea, TextField } from "./fields";
import { exceptionsToText } from "./hours-form";
import { HoursEditor } from "./HoursEditor";
import { KindPicker } from "./KindPicker";
import { TIER_KEY } from "./labels";
import { LiveCard } from "./LiveCard";
import { MediaField } from "./MediaField";
import { pinLabels } from "./pin-labels";
import { PlacePicker } from "./PlacePicker";
import styles from "./admin.module.css";
import e from "./editor.module.css";

const FORM_ID = "business-form";

/**
 * The business editor, in the order an admin works: who it is, where it is, how to reach it, when
 * it is open, how its card looks, and where it came from. The live card follows every change.
 */
export function BusinessForm({
  locale,
  kinds,
  sectors,
  business,
  placeName = null,
  uploads = false,
  advanced,
}: {
  locale: Locale;
  kinds: AdminKindDto[];
  sectors: AdminSectorDto[];
  business?: AdminBusinessDto;
  placeName?: string | null;
  /** Photo uploads are on (R2 set up on the API). */
  uploads?: boolean;
  /** The Advanced section's own content (source, seed ownership, history). */
  advanced?: ReactNode;
}) {
  const b = business;
  const t = (key: AdminKey, vars?: Record<string, string | number>) => at(locale, key, vars);
  const sectorOf = new Map(sectors.map((s) => [s.id, s]));
  const kindOptions = kinds
    .map((k) => ({
      id: k.id,
      slug: k.slug,
      name: pickText(k.name, locale),
      sector: sectorOf.has(k.sectorId) ? pickText(sectorOf.get(k.sectorId)!.name, locale) : "",
      rank: (sectorOf.get(k.sectorId)?.order ?? 0) * 10000 + k.order,
    }))
    .sort((x, y) => x.rank - y.rank);
  const kindSlug = new Map(kinds.map((k) => [k.id, k.slug]));
  const { delivers: _d, addressHidden: _h, ...otherAttributes } = b?.attributes ?? {};
  const days = (["day0", "day1", "day2", "day3", "day4", "day5", "day6"] as const).map((d) => t(d));
  const sections = [
    { id: "basics", label: t("secBasics") },
    { id: "location", label: t("secLocation") },
    { id: "contact", label: t("secContact") },
    { id: "hours", label: t("secHours") },
    { id: "card", label: t("secCard") },
    ...(b ? [{ id: "advanced", label: t("secAdvanced") }] : []),
  ];
  return (
    <EditorShell
      id={FORM_ID}
      action={saveBusiness}
      sections={sections}
      labels={editorLabels(locale)}
      submit={t(b ? "save" : "create")}
      after={
        // Outside the form: its buttons (return to seed data) are forms of their own.
        b ? (
          <Section id="advanced" title={t("secAdvanced")} hint={t("secAdvancedHint")}>
            {advanced}
          </Section>
        ) : null
      }
      preview={
        <>
          <p className={e.previewLabel}>{t("livePreview")}</p>
          <LiveCard
            formId={FORM_ID}
            locale={locale}
            copy={cardCopy[locale]}
            kinds={Object.fromEntries(
              kinds.map((k) => [
                k.id,
                { name: pickText(k.name, locale), accent: sectorOf.get(k.sectorId)?.accent ?? "" },
              ]),
            )}
            placeName={placeName}
            labels={{ title: t("livePreview"), unnamed: t("unnamed") }}
          />
        </>
      }
    >
      <input type="hidden" name="locale" value={locale} />
      {b ? <input type="hidden" name="id" value={b.id} /> : null}

      <Section id="basics" title={t("secBasics")} hint={t("secBasicsHint")}>
        <LocalizedFields locale={locale} label={t("fieldName")} name="name" value={b?.name} />
        <KindPicker
          kinds={kindOptions}
          primary={b?.primaryKindId ?? ""}
          extra={(b?.kindIds ?? [])
            .filter((id) => id !== b?.primaryKindId)
            .flatMap((id) => (kindSlug.has(id) ? [kindSlug.get(id)!] : []))}
          labels={{
            kind: t("fieldPrimaryKind"),
            also: t("fieldKinds"),
            add: t("addKind"),
            remove: t("remove"),
            none: t("chooseKind"),
          }}
        />
        {b ? null : (
          <div className={styles.row}>
            <PlacePicker locale={locale} label={t("fieldPlace")} hint={t("fieldPlaceHint")} />
            <TextField
              label={t("fieldSlug")}
              name="slug"
              dir="ltr"
              required
              hint={t("fieldSlugHint")}
            />
          </div>
        )}
        {b?.tier === "example" ? (
          <div className={styles.field}>
            <span className={styles.label}>{t("fieldTier")}</span>
            <strong>{t("tierExample")}</strong>
            <small className={styles.hint}>{t("tierFixed")}</small>
          </div>
        ) : (
          // Real businesses never become showroom examples (the API refuses example_tier_fixed).
          <Segmented
            legend={t("fieldTier")}
            name="tier"
            value={b?.tier ?? "basic"}
            options={TIERS.filter((x) => x !== "example").map((x) => [x, t(TIER_KEY[x])])}
            hint={t("fieldTierHint")}
          />
        )}
      </Section>

      <Section id="location" title={t("secLocation")} hint={t("secLocationHint")}>
        <BusinessLocation
          locale={locale}
          legend={t("fieldLocation")}
          value={b ? { lat: b.lat, lng: b.lng } : null}
          followPlace={!b}
          placeSlug={b?.placeSlug}
          labels={pinLabels(locale)}
        />
        <SubHead>{t("fieldAddress")}</SubHead>
        <LocalizedFields
          locale={locale}
          label={t("fieldAddress")}
          name="address"
          value={b?.address}
        />
        <Check
          name="addressHidden"
          label={t("fieldAddressHidden")}
          checked={b?.attributes.addressHidden === true}
        />
      </Section>

      <Section id="contact" title={t("secContact")}>
        <div className={styles.row}>
          <TextField
            label={t("fieldPhone")}
            name="phone"
            type="tel"
            defaultValue={b?.phone}
            dir="ltr"
          />
          <TextField
            label={t("fieldWhatsapp")}
            name="whatsapp"
            type="tel"
            defaultValue={b?.whatsapp}
            dir="ltr"
          />
          <TextField
            label={t("fieldWebsite")}
            name="website"
            type="url"
            defaultValue={b?.website}
            dir="ltr"
          />
        </div>
        <div className={styles.row}>
          <TextField
            label={t("fieldPhone2")}
            name="links.phone2"
            type="tel"
            defaultValue={b?.links.phone2?.replace(/^tel:/, "")}
            dir="ltr"
          />
          <TextField
            label={t("fieldEmail")}
            name="links.email"
            type="email"
            defaultValue={b?.links.email?.replace(/^mailto:/, "")}
            dir="ltr"
          />
        </div>
        <SubHead>{t("fieldOrdering")}</SubHead>
        <div className={styles.row}>
          {(
            [
              ["booking", "fieldBooking", "hintBooking"],
              ["order", "fieldOrder2", "hintOrder"],
              ["wolt", "fieldWolt", "hintLink"],
              ["tenbis", "fieldTenbis", "hintLink"],
            ] as const
          ).map(([key, label, hint]) => (
            <TextField
              key={key}
              label={t(label)}
              name={`links.${key}`}
              defaultValue={b?.links[key]}
              dir="ltr"
              hint={t(hint)}
            />
          ))}
        </div>
        <SubHead>{t("fieldLinks")}</SubHead>
        <div className={styles.row}>
          {(
            [
              ["google", "fieldGoogle", "hintGoogle"],
              ["instagram", "fieldInstagram", "hintHandle"],
              ["facebook", "fieldFacebook", "hintHandle"],
              ["tiktok", "fieldTiktok", "hintHandle"],
              ["youtube", "fieldYoutube", "hintHandle"],
              ["linkedin", "fieldLinkedin", "hintLink"],
              ["x", "fieldX", "hintHandle"],
              ["telegram", "fieldTelegram", "hintHandle"],
              ["waze", "fieldWaze", undefined],
            ] as const
          ).map(([key, label, hint]) => (
            <TextField
              key={key}
              label={t(label)}
              name={`links.${key}`}
              defaultValue={b?.links[key]}
              dir="ltr"
              hint={hint ? t(hint) : undefined}
            />
          ))}
        </div>
        <SubHead>{t("fieldApps")}</SubHead>
        <div className={styles.row}>
          <TextField
            label={t("fieldAppWeb")}
            name="apps.web"
            type="url"
            defaultValue={b?.apps.web}
            dir="ltr"
          />
          <TextField
            label={t("fieldAppIos")}
            name="apps.ios"
            type="url"
            defaultValue={b?.apps.ios}
            dir="ltr"
          />
          <TextField
            label={t("fieldAppAndroid")}
            name="apps.android"
            type="url"
            defaultValue={b?.apps.android}
            dir="ltr"
          />
        </div>
      </Section>

      <Section id="hours" title={t("secHours")}>
        <HoursEditor
          weekly={b?.hours.weekly ?? {}}
          labels={{
            days,
            closed: t("closed"),
            add: t("addHours"),
            remove: t("remove"),
            open: t("opens"),
            close: t("closes"),
          }}
        />
        <Check
          name="byAppointment"
          label={t("fieldByAppointment")}
          checked={b?.hours.byAppointment === true}
        />
        <TextArea
          label={t("fieldExceptions")}
          name="hours.exceptions"
          dir="ltr"
          rows={3}
          defaultValue={exceptionsToText(b?.hours.exceptions ?? [])}
        />
      </Section>

      <Section id="card" title={t("secCard")} hint={t("secCardHint")}>
        <LocalizedFields
          locale={locale}
          label={t("fieldTagline")}
          name="tagline"
          value={b?.tagline}
        />
        <div className={styles.row}>
          <Swatches
            legend={t("fieldAccent")}
            name="cardStyle.accent"
            value={b?.cardStyle.accent ?? ""}
            options={[...CARD_ACCENTS]}
            defaultLabel={t("accentDefault")}
          />
          <Segmented
            legend={t("fieldIcons")}
            name="cardStyle.icons"
            value={b?.cardStyle.icons ?? "line"}
            options={[
              ["line", t("iconsLine")],
              ["solid", t("iconsSolid")],
            ]}
          />
        </div>
        <MediaField
          mediaUrl={MEDIA_ORIGIN}
          uploads={uploads}
          logo={b?.logo?.key ?? null}
          photos={b?.photos ?? []}
          labels={{
            logo: t("fieldLogo"),
            photos: t("fieldPhotos"),
            add: t("addImage"),
            uploading: t("uploading"),
            off: t("uploadOff"),
            failed: t("uploadFailed"),
            remove: t("remove"),
            moveFirst: t("moveFirst"),
          }}
        />
        <SubHead>{t("fieldFacts")}</SubHead>
        <input type="hidden" name="attributes.base" value={JSON.stringify(otherAttributes)} />
        <Check
          name="delivers"
          label={t("fieldDelivers")}
          checked={b?.attributes.delivers === true}
        />
        <Check
          name="glutenFree"
          label={t("fieldGlutenFree")}
          checked={b?.dietary.includes("gluten_free") === true}
          hint={t("fieldGlutenFreeHint")}
        />
        <details className={e.details}>
          <summary>{t("fieldExperienceTitle")}</summary>
          <p className={styles.hint}>{t("fieldExperienceHint")}</p>
          <TextArea
            label={t("fieldExperience")}
            name="experience"
            dir="ltr"
            rows={14}
            defaultValue={JSON.stringify(b?.experience ?? EMPTY_EXPERIENCE, null, 2)}
          />
        </details>
      </Section>
    </EditorShell>
  );
}
