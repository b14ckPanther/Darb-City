"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import type { Locale } from "@darb/core";
import { updateHelper } from "./actions";
import { ht } from "./copy";
import { idleForm } from "./form-state";
import admin from "@/admin/admin.module.css";
import styles from "./helpers.module.css";

/** The display name and the public credit toggle, each saved on its own. */
export function ProfileForm({
  locale,
  name,
  credit,
}: {
  locale: Locale;
  name: string;
  credit: boolean;
}) {
  const t = (key: Parameters<typeof ht>[1], vars?: Record<string, string>) => ht(locale, key, vars);
  const id = useId();
  const [named, saveName, savingName] = useActionState(updateHelper, idleForm);
  const [credited, saveCredit, savingCredit] = useActionState(updateHelper, idleForm);
  const creditForm = useRef<HTMLFormElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (named.ok || credited.ok) status.current?.focus();
  }, [named, credited]);
  return (
    <>
      <form action={saveName} noValidate aria-busy={savingName}>
        <input type="hidden" name="locale" value={locale} />
        <label className={admin.field}>
          <span>{t("profileName")}</span>
          <input
            name="name"
            defaultValue={name}
            maxLength={60}
            required
            dir="auto"
            autoComplete="nickname"
            aria-invalid={named.errors.name ? true : undefined}
            aria-describedby={named.errors.name ? `${id}-name` : undefined}
          />
          {named.errors.name ? (
            <small id={`${id}-name`} className={admin.fieldError}>
              {named.errors.name}
            </small>
          ) : null}
        </label>
        <button type="submit" className={styles.ghost} disabled={savingName}>
          {t("profileSave")}
        </button>
      </form>

      <form ref={creditForm} action={saveCredit} aria-busy={savingCredit}>
        <input type="hidden" name="locale" value={locale} />
        {/* The unchecked box sends nothing: this hidden one says "off" then. */}
        <input type="hidden" name="credit" value="false" />
        <label className={styles.toggle}>
          <input
            type="checkbox"
            name="credit"
            value="on"
            defaultChecked={credit}
            disabled={savingCredit}
            aria-describedby={`${id}-credit`}
            onChange={() => creditForm.current?.requestSubmit()}
          />
          <span>
            <strong>{t("profileCredit")}</strong>
            <br />
            <small id={`${id}-credit`} className={admin.hint}>
              {t("profileCreditHint", { name: name || "…" })}
            </small>
          </span>
        </label>
      </form>
      <p ref={status} tabIndex={-1} role="status" className={admin.hint}>
        {named.errors.form || credited.errors.form
          ? (named.errors.form ?? credited.errors.form)
          : named.ok || credited.ok
            ? t("profileSaved")
            : ""}
      </p>
    </>
  );
}
