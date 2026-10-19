"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FilterOption } from "./ListToolbar";
import { placeOptions } from "./list-actions";
import styles from "./editor.module.css";
import admin from "./admin.module.css";

/**
 * A new business's place: type a name (any alphabet) or address, pick from the list. The form
 * gets `place` (the address, as before) and the location map follows the pick.
 */
export function PlacePicker({
  locale,
  label,
  hint,
}: {
  locale: string;
  label: string;
  hint: string;
}) {
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<{ q: string; options: FilterOption[] }>({
    q: "",
    options: [],
  });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hidden = useRef<HTMLInputElement>(null);
  const id = useId();
  const q = text.trim();
  const options = answer.q === q ? answer.options : [];

  useEffect(() => {
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const found = await placeOptions(locale, q);
      if (live) setAnswer({ q, options: found });
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, locale]);

  const choose = (o: FilterOption) => {
    setText(o.label);
    setOpen(false);
    const field = hidden.current;
    if (!field) return;
    field.value = o.value;
    // The location map listens for the place's change.
    field.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const showing = open && q.length >= 2 && options.length > 0;
  return (
    <div className={`${admin.field} ${styles.picker}`}>
      <label htmlFor={id}>
        <span className={admin.label}>{label}</span>
      </label>
      <input type="hidden" name="place" ref={hidden} />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showing}
        aria-controls={`${id}-list`}
        aria-activedescendant={showing ? `${id}-${active}` : undefined}
        aria-autocomplete="list"
        aria-describedby={`${id}-hint`}
        value={text}
        autoComplete="off"
        dir="auto"
        required
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
          if (hidden.current) hidden.current.value = "";
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showing) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + options.length) % options.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const o = options[active];
            if (o) choose(o);
          } else if (e.key === "Escape") setOpen(false);
        }}
        data-place-picker=""
      />
      <small id={`${id}-hint`} className={admin.hint}>
        {hint}
      </small>
      {showing ? (
        <ul id={`${id}-list`} role="listbox" className={styles.options} aria-label={label}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              className={styles.option}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              data-place-option={o.value}
            >
              <bdi>{o.label}</bdi>
              {o.note ? <small>{o.note}</small> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
