"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { InquiryTopic } from "@darb/contracts";
import type { Locale } from "@darb/core";
import type { ContactFormCopy } from "@/content/contact";
import {
  fieldErrors,
  inquiryBody,
  LIMITS,
  type ContactFields,
  type FieldError,
} from "@/lib/contact-form";
import styles from "./Contact.module.css";

type Phase = "editing" | "sending" | "sent" | "failed" | "tooMany";

const TOPICS: InquiryTopic[] = ["general", "join", "plan", "other"];

/**
 * The /contact form. Checked here first (inline, per field), then posted to /api/contact, which
 * forwards it to the API. A refusal keeps everything typed, so Try again sends the same message.
 */
export function ContactForm({
  locale,
  copy,
  initialTopic,
  plan,
  planName,
}: {
  locale: Locale;
  copy: ContactFormCopy;
  initialTopic: InquiryTopic;
  /** The plan slug from ?plan=, sent with a plan message. */
  plan: string | null;
  planName: string | null;
}) {
  const id = useId();
  const empty: ContactFields = {
    name: "",
    contact: "",
    businessName: "",
    topic: initialTopic,
    message: "",
  };
  const [fields, setFields] = useState<ContactFields>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFields, FieldError>>>({});
  const [phase, setPhase] = useState<Phase>("editing");
  const [checked, setChecked] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const thanks = useRef<HTMLHeadingElement>(null);
  const alert = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase === "sent") thanks.current?.focus();
    if (phase === "failed" || phase === "tooMany") alert.current?.focus();
  }, [phase]);

  const set = (key: keyof ContactFields, value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    // After the first try, each field clears its message as soon as it is right.
    if (checked) setErrors(fieldErrors(next));
  };

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (phase === "sending") return;
    const found = fieldErrors(fields);
    setChecked(true);
    setErrors(found);
    const first = (["name", "contact", "message"] as const).find((k) => found[k]);
    if (first) {
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    const website =
      form.current?.querySelector<HTMLInputElement>('[name="website"]')?.value.trim() ?? "";
    setPhase("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(inquiryBody(fields, plan, locale, website)),
      });
      setPhase(res.status === 201 ? "sent" : res.status === 429 ? "tooMany" : "failed");
    } catch {
      setPhase("failed");
    }
  }

  if (phase === "sent")
    return (
      <div className={styles.thanks} role="status">
        <span className={styles.thanksMark} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path d="M5 12.5 9.5 17 19 7.5" />
          </svg>
        </span>
        <h2 ref={thanks} tabIndex={-1} className={styles.thanksTitle}>
          {copy.thanksTitle}
        </h2>
        <p>{copy.thanksBody}</p>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            setFields(empty);
            setErrors({});
            setChecked(false);
            setPhase("editing");
          }}
        >
          {copy.sendAnother}
        </button>
      </div>
    );

  const sending = phase === "sending";
  const field = (key: "name" | "contact", label: string, props: object, hint?: string) => {
    const error = errors[key];
    const describedBy = [hint ? `${id}-${key}-hint` : "", error ? `${id}-${key}-error` : ""]
      .filter(Boolean)
      .join(" ");
    return (
      <div className={styles.field}>
        <label htmlFor={`${id}-${key}`}>{label}</label>
        <input
          id={`${id}-${key}`}
          name={key}
          value={fields[key]}
          onChange={(e) => set(key, e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          required
          {...props}
        />
        {hint ? (
          <p id={`${id}-${key}-hint`} className={styles.hint}>
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-${key}-error`} className={styles.fieldError}>
            {copy.errors[error]}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form
      ref={form}
      className={styles.form}
      onSubmit={submit}
      noValidate
      aria-busy={sending}
      aria-labelledby="main-heading"
    >
      <div className={styles.row}>
        {field("name", copy.name, {
          autoComplete: "name",
          maxLength: LIMITS.name[1],
        })}
        {field(
          "contact",
          copy.contact,
          { autoComplete: "on", maxLength: LIMITS.contact[1], dir: "auto" },
          copy.contactHint,
        )}
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${id}-business`}>
            {copy.business} <span className={styles.optional}>({copy.optional})</span>
          </label>
          <input
            id={`${id}-business`}
            name="businessName"
            value={fields.businessName}
            onChange={(e) => set("businessName", e.target.value)}
            autoComplete="organization"
            maxLength={LIMITS.business}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-topic`}>{copy.topic}</label>
          <select
            id={`${id}-topic`}
            name="topic"
            value={fields.topic}
            onChange={(e) => set("topic", e.target.value)}
            aria-describedby={fields.topic === "plan" && planName ? `${id}-plan` : undefined}
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {copy.topics[t]}
              </option>
            ))}
          </select>
          {fields.topic === "plan" && planName ? (
            <p id={`${id}-plan`} className={styles.plan}>
              {copy.aboutPlan.replace("{plan}", planName)}
            </p>
          ) : null}
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-message`}>{copy.message}</label>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={6}
          value={fields.message}
          onChange={(e) => set("message", e.target.value)}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? `${id}-message-error` : undefined}
          maxLength={LIMITS.message[1]}
          dir="auto"
          required
        />
        {errors.message ? (
          <p id={`${id}-message-error`} className={styles.fieldError}>
            {copy.errors[errors.message]}
          </p>
        ) : null}
      </div>
      {/* People never see this field; a bot that fills it is thanked and nothing is kept. */}
      <div className={styles.trap} aria-hidden="true">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {phase === "failed" || phase === "tooMany" ? (
        <div ref={alert} tabIndex={-1} role="alert" className={styles.alert}>
          <p>{phase === "tooMany" ? copy.errors.tooMany : copy.errors.failed}</p>
          {phase === "failed" ? (
            <button type="button" className={styles.secondary} onClick={() => void submit()}>
              {copy.retry}
            </button>
          ) : null}
        </div>
      ) : null}
      <button type="submit" className={styles.send} disabled={sending}>
        {sending ? copy.sending : copy.send}
      </button>
    </form>
  );
}
