"use client";

import { useState, type Ref } from "react";
import styles from "./Auth.module.css";

export const CODE_LENGTH = 6;

/** Keeps the digits only, reading Arabic and Persian digits as 0 to 9 (some keyboards type them). */
export function digitsOnly(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "")
    .slice(0, CODE_LENGTH);
}

/**
 * The 6 digit code: one real input (so paste, the keyboard's code suggestion and screen readers all
 * just work) under six big cells. Always left to right, also on a Hebrew or Arabic page: the first
 * digit is the leftmost and typing moves right. The sixth digit sends the code.
 */
export function CodeField({
  label,
  value,
  onChange,
  onComplete,
  invalid,
  disabled,
  describedBy,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onComplete: (code: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, CODE_LENGTH - 1);
  return (
    <div className={styles.code} dir="ltr" data-invalid={invalid ? "" : undefined}>
      <input
        ref={inputRef}
        className={styles.codeInput}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        name="code"
        dir="ltr"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_LENGTH}
        spellCheck={false}
        value={value}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const next = digitsOnly(e.target.value);
          // Keep the caret at the end: cells fill strictly left to right.
          e.target.setSelectionRange(next.length, next.length);
          onChange(next);
          if (next.length === CODE_LENGTH && next !== value) onComplete(next);
        }}
        onSelect={(e) => {
          const input = e.currentTarget;
          const end = input.value.length;
          if (input.selectionStart !== end || input.selectionEnd !== end)
            input.setSelectionRange(end, end);
        }}
      />
      <div className={styles.cells} aria-hidden="true">
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span
            key={i}
            className={styles.cell}
            data-filled={value[i] ? "" : undefined}
            data-active={focused && i === active ? "" : undefined}
          >
            {value[i] ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}
