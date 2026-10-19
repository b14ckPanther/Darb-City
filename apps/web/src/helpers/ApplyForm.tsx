"use client";

import { useActionState, useId, useState } from "react";
import type { Locale } from "@darb/core";
import { SearchPicker, type PickerOption } from "@/components/join/SearchPicker";
import { applyHelper } from "./actions";
import { ht } from "./copy";
import { idleForm } from "./form-state";
import admin from "@/admin/admin.module.css";
import styles from "./helpers.module.css";

/** A town in the picker: the picker speaks slugs, the API wants the place's id. */
export interface TownOption extends PickerOption {
  id: string;
}

/** The one-screen form: display name, phone, home town (information only) and a short "why". */
export function ApplyForm({
  locale,
  towns,
  name: initialName = "",
}: {
  locale: Locale;
  towns: TownOption[];
  name?: string;
}) {
  const t = (key: Parameters<typeof ht>[1]) => ht(locale, key);
  const id = useId();
  const [state, action, pending] = useActionState(applyHelper, idleForm);
  const [town, setTown] = useState("");
  const placeId = towns.find((o) => o.slug === town)?.id ?? "";
  const err = (name: string) => state.errors[name] ?? null;
  return (
    <form action={action} noValidate aria-busy={pending}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="placeId" value={placeId} />
      {/* The hint sits outside the label, so each field's name is its label alone. */}
      <div className={admin.field}>
        <label htmlFor={`${id}-name-input`} className={admin.label}>
          {t("applyName")}
        </label>
        <input
          id={`${id}-name-input`}
          name="name"
          defaultValue={initialName}
          autoComplete="nickname"
          maxLength={60}
          required
          dir="auto"
          aria-invalid={err("name") ? true : undefined}
          aria-describedby={`${id}-name`}
        />
        <small id={`${id}-name`} className={err("name") ? admin.fieldError : admin.hint}>
          {err("name") ?? t("applyNameHint")}
        </small>
      </div>
      <div className={admin.field}>
        <label htmlFor={`${id}-phone-input`} className={admin.label}>
          {t("applyPhone")}
        </label>
        <input
          id={`${id}-phone-input`}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          required
          aria-invalid={err("phone") ? true : undefined}
          aria-describedby={`${id}-phone`}
        />
        <small id={`${id}-phone`} className={err("phone") ? admin.fieldError : admin.hint}>
          {err("phone") ?? t("applyPhoneHint")}
        </small>
      </div>
      <SearchPicker
        label={t("applyTown")}
        placeholder={t("applyTownSearch")}
        noMatch={t("applyNoMatch")}
        options={towns}
        value={town}
        onChange={setTown}
        inputId={`${id}-town`}
        errorId={`${id}-town-error`}
        error={err("placeId")}
      />
      <p className={admin.hint}>{t("applyTownHint")}</p>
      <label className={admin.field}>
        <span>{t("applyNote")}</span>
        <textarea name="note" rows={3} maxLength={500} dir="auto" />
      </label>
      {err("form") ? (
        <p className={admin.error} role="alert">
          {err("form")}
        </p>
      ) : null}
      <button type="submit" className={styles.primary} disabled={pending}>
        {t(pending ? "applySending" : "applySend")}
      </button>
    </form>
  );
}
