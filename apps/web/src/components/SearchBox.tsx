"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "@darb/core";
import type { PopupProps } from "@/search/SearchPopup";
import type { SearchLabels, SearchOption } from "@/search/types";
import styles from "./SearchBox.module.css";

/** The index, matcher and listbox: one lazy chunk, fetched on first focus (budget: 30 KB). */
const SearchPopup = dynamic<PopupProps>(
  () => import("@/search/SearchPopup").then((m) => m.SearchPopup),
  {
    ssr: false,
  },
);

/** The place in the URL (first segment after the locale), so its businesses are suggested first. */
function placeFrom(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0] === "ar" || parts[0] === "en" ? parts[1] : parts[0];
  return first && !["k", "search", "for-business"].includes(first) ? first : null;
}

/** WAI-ARIA editable combobox with list autocomplete (APG "combobox with listbox popup"). */
export function SearchBox({ locale, labels }: { locale: Locale; labels: SearchLabels }) {
  const router = useRouter();
  const pathname = usePathname();
  const input = useRef<HTMLInputElement>(null);
  const listboxId = useId().replace(/:/g, "") + "-listbox";
  const [value, setValue] = useState("");
  const [wanted, setWanted] = useState(false); // the lazy chunk was asked for
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SearchOption[]>([]);
  // The active option by id, so business names arriving late never move or drop the selection.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = activeKey === null ? -1 : options.findIndex((o) => o.id === activeKey);
  const activeId = open && options[active] ? `${listboxId}-${options[active].id}` : null;

  useEffect(() => {
    document.documentElement.toggleAttribute("data-search-open", open);
    return () => document.documentElement.removeAttribute("data-search-open");
  }, [open]);

  // ⌘K / Ctrl+K from anywhere (spec §3.3).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const onOptions = useCallback((next: SearchOption[]) => setOptions(next), []);

  const pick = useCallback(
    (option: SearchOption) => {
      setOpen(false);
      router.push(option.href);
    },
    [router],
  );

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const count = options.length;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (count === 0) return;
        e.preventDefault();
        setOpen(true);
        const step = e.key === "ArrowDown" ? 1 : -1;
        const next = active < 0 ? (step > 0 ? 0 : count - 1) : (active + step + count) % count;
        setActiveKey(options[next]?.id ?? null);
        return;
      }
      case "Enter": {
        const option = open ? options[active] : undefined;
        if (option) {
          e.preventDefault();
          pick(option);
        } // otherwise the form submits to /search?q=
        return;
      }
      case "Escape": {
        // Each step handles the key, so an open business sheet stays open (M5).
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActiveKey(null);
        } else if (value !== "") {
          e.preventDefault();
          setValue("");
          setOptions([]);
        }
        return;
      }
    }
  }

  return (
    <div className={styles.box}>
      <input
        ref={input}
        id="q"
        name="q"
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeId ?? undefined}
        placeholder={labels.placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className={styles.input}
        value={value}
        onFocus={() => setWanted(true)}
        onChange={(e) => {
          setValue(e.target.value);
          setActiveKey(null);
          setWanted(true);
          setOpen(e.target.value.trim() !== "");
        }}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null))
            setOpen(false);
        }}
      />
      {wanted ? (
        <div className={styles.popup} hidden={!open}>
          <SearchPopup
            locale={locale}
            query={value}
            place={placeFrom(pathname)}
            labels={labels}
            listboxId={listboxId}
            activeId={activeId}
            onOptions={onOptions}
            onPick={pick}
          />
        </div>
      ) : null}
    </div>
  );
}
