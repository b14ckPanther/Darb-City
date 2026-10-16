"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import type { JoinSuggestionDto } from "@darb/contracts";
import { CARD_ACCENTS, CARD_ICON_STYLES, LOCALES, type Locale } from "@darb/core";
import { LocationPicker } from "@/components/LocationPicker";
import type { JoinCopy } from "@/content/join";
import {
  ERROR_ORDER,
  fieldErrors,
  joinBody,
  MAX_PHOTOS,
  type JoinError,
  type JoinFields,
} from "@/lib/join-form";
import { CardPreview } from "./CardPreview";
import type { PlaceOption } from "./JoinFlow";
import { PhotoField } from "./PhotoField";
import { SearchPicker, type PickerOption } from "./SearchPicker";
import { WeekHours } from "./WeekHours";
import styles from "./Join.module.css";

type Phase = "editing" | "sending" | "failed" | "tooMany";

/**
 * "Check your card": everything the lookup found, editable and grouped, beside a live preview of
 * the card. Checked here first (inline, per field), then posted to /api/join.
 */
export function CheckStep({
  locale,
  copy,
  kinds,
  places,
  uploads,
  initial,
  suggestion,
  notice,
  headingRef,
  onBack,
  onSent,
}: {
  locale: Locale;
  copy: JoinCopy;
  kinds: PickerOption[];
  places: PlaceOption[];
  uploads: boolean;
  initial: JoinFields;
  suggestion: JoinSuggestionDto | null;
  notice: "none" | "off" | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onSent: () => void;
}) {
  const id = useId();
  const c = copy.check;
  const [f, setF] = useState<JoinFields>(initial);
  const [errors, setErrors] = useState<Partial<Record<JoinError, true>>>({});
  const [checked, setChecked] = useState(false);
  const [phase, setPhase] = useState<Phase>("editing");
  const form = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  // This step loads on demand, so it takes the focus itself once it is there.
  useEffect(() => headingRef.current?.focus(), [headingRef]);

  const set = <K extends keyof JoinFields>(key: K, value: JoinFields[K]) => {
    setF((prev) => {
      const next = { ...prev, [key]: value };
      // After the first try, each field clears its message as soon as it is right.
      if (checked) setErrors(fieldErrors(next));
      return next;
    });
  };
  const fid = (key: string) => `${id}-${key}`;
  const err = (key: JoinError) => (errors[key] ? copy.errors[key] : null);
  const describe = (key: JoinError, hint?: string) =>
    [hint ?? "", errors[key] ? `${fid(key)}-error` : ""].filter(Boolean).join(" ") || undefined;
  const errorText = (key: JoinError) =>
    errors[key] ? (
      <p id={`${fid(key)}-error`} className={styles.fieldError}>
        {copy.errors[key]}
      </p>
    ) : null;

  const text = (
    key: "phone" | "whatsapp" | "website" | "instagram" | "facebook" | "tiktok",
    label: string,
    props: object,
    hint?: string,
  ) => (
    <div className={styles.field}>
      <label htmlFor={fid(key)}>
        {label} <span className={styles.optional}>({c.optional})</span>
      </label>
      <input
        id={fid(key)}
        value={f[key]}
        dir="ltr"
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={describe(key, hint ? `${fid(key)}-hint` : undefined)}
        {...props}
      />
      {hint ? (
        <p id={`${fid(key)}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {errorText(key)}
    </div>
  );

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (phase === "sending") return;
    const found = fieldErrors(f);
    setChecked(true);
    setErrors(found);
    const first = ERROR_ORDER.find((k) => found[k]);
    if (first) {
      const target = document.getElementById(fid(first));
      (target?.matches("input, select, textarea, button")
        ? target
        : target?.querySelector<HTMLElement>("input, button")
      )?.focus();
      return;
    }
    const website2 =
      form.current?.querySelector<HTMLInputElement>('[name="website2"]')?.value.trim() ?? "";
    setPhase("sending");
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          joinBody(f, {
            locale,
            source: suggestion ? "lookup" : "manual",
            lookup: suggestion,
            website2,
          }),
        ),
      });
      if (res.status === 201) return onSent();
      setPhase(res.status === 429 ? "tooMany" : "failed");
    } catch {
      setPhase("failed");
    }
    requestAnimationFrame(() => alertRef.current?.focus());
  }

  const place = places.find((p) => p.slug === f.placeSlug) ?? null;
  const kind = kinds.find((k) => k.slug === f.kindSlug) ?? null;
  const otherLocales = LOCALES.filter((l) => l !== locale);
  const sending = phase === "sending";
  const anyError = checked && Object.keys(errors).length > 0;

  return (
    <div className={styles.check}>
      <header className={styles.checkHead}>
        <h2 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
          {c.title}
        </h2>
        {notice ? (
          <p className={styles.notice}>{copy.find[notice]}</p>
        ) : (
          <p className={styles.hint}>{c.lead}</p>
        )}
        {suggestion?.sources.length ? (
          <p className={styles.sources}>
            {c.foundOn}{" "}
            {suggestion.sources.map((s, i) => (
              <span key={s}>
                {i > 0 ? ", " : ""}
                <a href={s} target="_blank" rel="noopener noreferrer nofollow" dir="ltr">
                  {hostOf(s)}
                </a>
              </span>
            ))}
          </p>
        ) : null}
        {suggestion?.osm ? (
          <p className={styles.sources}>
            <a href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">
              {c.osm}
            </a>
          </p>
        ) : null}
        <button type="button" className={styles.linkButton} onClick={onBack}>
          {c.back}
        </button>
      </header>
      <div className={styles.checkLayout}>
        <form
          ref={form}
          className={styles.form}
          onSubmit={submit}
          noValidate
          aria-busy={sending}
          aria-label={c.title}
        >
          <fieldset className={styles.group}>
            <legend>{c.business}</legend>
            <div className={styles.field}>
              <label htmlFor={fid("name")}>{c.name}</label>
              <input
                id={fid("name")}
                value={f.name[locale]}
                dir="auto"
                maxLength={120}
                autoComplete="organization"
                onChange={(e) => set("name", { ...f.name, [locale]: e.target.value })}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={describe("name", `${fid("name")}-hint`)}
              />
              <p id={`${fid("name")}-hint`} className={styles.hint}>
                {c.nameHint}
              </p>
              {errorText("name")}
            </div>
            <details
              className={styles.more}
              open={otherLocales.some((l) => f.name[l]) || undefined}
            >
              <summary>{c.nameOther}</summary>
              {otherLocales.map((l) => (
                <div key={l} className={styles.field}>
                  <label htmlFor={fid(`name-${l}`)}>
                    {c.name} <span className={styles.optional}>({l})</span>
                  </label>
                  <input
                    id={fid(`name-${l}`)}
                    lang={l}
                    dir={l === "en" ? "ltr" : "rtl"}
                    value={f.name[l]}
                    maxLength={120}
                    onChange={(e) => set("name", { ...f.name, [l]: e.target.value })}
                  />
                </div>
              ))}
            </details>
            <SearchPicker
              label={c.type}
              placeholder={c.typeSearch}
              noMatch={c.noMatch}
              options={kinds}
              value={f.kindSlug}
              onChange={(v) => set("kindSlug", v)}
              inputId={fid("kind")}
              errorId={`${fid("kind")}-error`}
              error={err("kind")}
            />
            <SearchPicker
              label={c.town}
              placeholder={c.townSearch}
              noMatch={c.noMatch}
              options={places}
              value={f.placeSlug}
              onChange={(v) => set("placeSlug", v)}
              inputId={fid("place")}
              errorId={`${fid("place")}-error`}
              error={err("place")}
            />
          </fieldset>

          <fieldset className={styles.group} id={fid("point")}>
            <legend>{c.location}</legend>
            <p className={styles.hint}>{c.locationHint}</p>
            <LocationPicker
              value={f.point}
              onChange={(p) => set("point", p)}
              locale={locale}
              near={place ? { lat: place.lat, lng: place.lng } : null}
              labels={copy.map}
              names={{ lat: "lat-shown", lng: "lng-shown" }}
            />
            {errorText("point")}
            <div className={styles.field}>
              <label htmlFor={fid("address")}>
                {c.address} <span className={styles.optional}>({c.optional})</span>
              </label>
              <input
                id={fid("address")}
                value={f.address}
                dir="auto"
                maxLength={200}
                autoComplete="street-address"
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>{c.contact}</legend>
            <div className={styles.row}>
              {text("phone", c.phone, { type: "tel", autoComplete: "tel", maxLength: 20 })}
              <div className={styles.field}>
                <label className={styles.check2}>
                  <input
                    type="checkbox"
                    checked={f.whatsappSame}
                    onChange={(e) => set("whatsappSame", e.target.checked)}
                  />
                  <span>
                    {c.whatsapp}: {c.sameAsPhone}
                  </span>
                </label>
              </div>
            </div>
            {f.whatsappSame
              ? null
              : text("whatsapp", c.whatsapp, { type: "tel", autoComplete: "tel", maxLength: 20 })}
          </fieldset>

          <fieldset className={styles.group}>
            <legend>{c.links}</legend>
            {text("website", c.website, { type: "url", inputMode: "url", maxLength: 500 })}
            <div className={styles.row}>
              {text("instagram", c.instagram, { maxLength: 300 }, c.handleHint)}
              {text("facebook", c.facebook, { maxLength: 300 }, c.handleHint)}
            </div>
            {text("tiktok", c.tiktok, { maxLength: 300 }, c.handleHint)}
          </fieldset>

          <fieldset className={styles.group} id={fid("hours")}>
            <legend>{c.hours}</legend>
            <WeekHours
              week={f.week}
              onChange={(w) => set("week", w)}
              copy={copy.hours}
              invalid={Boolean(errors.hours)}
              errorId={`${fid("hours")}-error`}
            />
            {errorText("hours")}
          </fieldset>

          <fieldset className={styles.group}>
            <legend>{c.description}</legend>
            <p id={`${fid("description")}-hint`} className={styles.hint}>
              {c.descriptionHint}
            </p>
            <textarea
              id={fid("description")}
              aria-label={c.description}
              aria-describedby={`${fid("description")}-hint`}
              rows={3}
              dir="auto"
              maxLength={400}
              value={f.description[locale] || Object.values(f.description).find(Boolean) || ""}
              onChange={(e) => set("description", { ...f.description, [locale]: e.target.value })}
            />
          </fieldset>

          {uploads ? (
            <fieldset className={styles.group}>
              <legend>{c.photos}</legend>
              <PhotoField
                copy={c}
                errors={copy.errors}
                logo={f.logo}
                photos={f.photos}
                max={MAX_PHOTOS}
                onLogo={(u) => set("logo", u)}
                onPhotos={(u) => set("photos", u)}
              />
            </fieldset>
          ) : null}

          <fieldset className={styles.group}>
            <legend>{c.style}</legend>
            <div className={styles.swatches} role="radiogroup" aria-label={c.accent}>
              {CARD_ACCENTS.map((a, i) => (
                <label key={a} className={styles.swatch} style={{ background: a }}>
                  <input
                    type="radio"
                    name="accent"
                    value={a}
                    checked={f.accent === a}
                    onChange={() => set("accent", a)}
                    className={styles.srOnly}
                  />
                  <span className={styles.srOnly}>{`${c.accent} ${i + 1}`}</span>
                </label>
              ))}
            </div>
            <div className={styles.segmented} role="radiogroup" aria-label={c.icons}>
              {CARD_ICON_STYLES.map((s) => (
                <label key={s} className={styles.segment}>
                  <input
                    type="radio"
                    name="icons"
                    value={s}
                    checked={f.icons === s}
                    onChange={() => set("icons", s)}
                  />
                  <span>{s === "line" ? c.iconsLine : c.iconsSolid}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={`${styles.group} ${styles.private}`}>
            <legend>{c.owner}</legend>
            <p className={styles.hint}>{c.ownerHint}</p>
            <div className={styles.row}>
              {(
                [
                  ["ownerName", c.ownerName, { autoComplete: "name", maxLength: 80, dir: "auto" }],
                  [
                    "ownerPhone",
                    c.ownerPhone,
                    { type: "tel", autoComplete: "tel", maxLength: 20, dir: "ltr" },
                  ],
                ] as const
              ).map(([key, label, props]) => (
                <div key={key} className={styles.field}>
                  <label htmlFor={fid(key)}>{label}</label>
                  <input
                    id={fid(key)}
                    value={f[key]}
                    onChange={(e) => set(key, e.target.value)}
                    aria-invalid={errors[key] ? true : undefined}
                    aria-describedby={describe(key)}
                    required
                    {...props}
                  />
                  {errorText(key)}
                </div>
              ))}
            </div>
            <div className={styles.field}>
              <label htmlFor={fid("ownerEmail")}>
                {c.ownerEmail} <span className={styles.optional}>({c.optional})</span>
              </label>
              <input
                id={fid("ownerEmail")}
                type="email"
                dir="ltr"
                autoComplete="email"
                maxLength={120}
                value={f.ownerEmail}
                onChange={(e) => set("ownerEmail", e.target.value)}
                aria-invalid={errors.ownerEmail ? true : undefined}
                aria-describedby={describe("ownerEmail")}
              />
              {errorText("ownerEmail")}
            </div>
            <div className={styles.field}>
              <label htmlFor={fid("note")}>
                {c.note} <span className={styles.optional}>({c.optional})</span>
              </label>
              <textarea
                id={fid("note")}
                rows={2}
                dir="auto"
                maxLength={1000}
                value={f.note}
                onChange={(e) => set("note", e.target.value)}
              />
            </div>
          </fieldset>

          {/* People never see this field; a bot that fills it is thanked and nothing is kept. */}
          <div className={styles.trap} aria-hidden="true">
            <label htmlFor={fid("website2")}>Website</label>
            <input id={fid("website2")} name="website2" tabIndex={-1} autoComplete="off" />
          </div>

          {anyError ? (
            <p className={styles.fieldError} role="status">
              {copy.errors.fix}
            </p>
          ) : null}
          {phase === "failed" || phase === "tooMany" ? (
            <div ref={alertRef} tabIndex={-1} role="alert" className={styles.alert}>
              <p>{phase === "tooMany" ? copy.errors.tooMany : copy.errors.failed}</p>
            </div>
          ) : null}
          <button type="submit" className={styles.primary} disabled={sending}>
            {sending ? c.sending : c.send}
          </button>
        </form>
        <aside className={styles.previewAside} aria-label={copy.preview.title}>
          <p className={styles.previewTitle} aria-hidden="true">
            {copy.preview.title}
          </p>
          <CardPreview
            copy={copy.preview}
            name={f.name[locale] || Object.values(f.name).find((v) => v.trim()) || ""}
            kindName={kind?.label ?? null}
            townName={place?.label ?? null}
            address={f.address}
            accent={f.accent}
            icons={f.icons}
            logoUrl={f.logo?.url ?? null}
            photoUrl={f.photos[0]?.url ?? null}
            phone={f.phone}
            whatsapp={f.whatsappSame ? f.phone : f.whatsapp}
            point={f.point}
            website={f.website}
            instagram={f.instagram}
            facebook={f.facebook}
            tiktok={f.tiktok}
            week={f.week}
          />
        </aside>
      </div>
    </div>
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
