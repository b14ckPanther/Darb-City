"use client";

import { useEffect, useState } from "react";
import { CARD_ACCENTS, isByAppointment, type CardAccent, type Locale } from "@darb/core";
import { BusinessCard } from "@/components/card/BusinessCard";
import type { CardCopy } from "@/content/card";
import { cardFromDraft, mediaUrl } from "@/lib/card";
import { formValues } from "./editor-state";
import styles from "./editor.module.css";

const parse = <T,>(raw: string | undefined, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * The public card, drawn from the editor's form as it is now: the very component the city's sheet
 * draws (in preview mode, so its buttons go nowhere). Redrawn on every change.
 */
export function LiveCard({
  formId,
  locale,
  copy,
  kinds,
  placeName,
  labels,
}: {
  formId: string;
  locale: Locale;
  copy: CardCopy;
  /** id → name and the category's colour (a card without its own accent wears it). */
  kinds: Record<string, { name: string; accent: string }>;
  placeName: string | null;
  labels: { title: string; unnamed: string };
}) {
  const [read, setRead] = useState<{ v: Record<string, string>; at: number } | null>(null);
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRead({ v: formValues(form), at: Date.now() }));
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    const observer = new MutationObserver(read);
    observer.observe(form, { subtree: true, attributes: true, attributeFilter: ["value"] });
    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
      observer.disconnect();
    };
  }, [formId]);
  if (!read) return null;
  const v = read.v;

  const pick = (key: string) =>
    (v[`${key}.${locale}`] || v[`${key}.he`] || v[`${key}.ar`] || v[`${key}.en`] || "").trim();
  const kind = kinds[v["primaryKindId"] ?? ""];
  const own = v["cardStyle.accent"] ?? "";
  const accent = CARD_ACCENTS.includes(own as CardAccent) ? own : (kind?.accent ?? CARD_ACCENTS[0]);
  const weekly = Object.fromEntries(
    Object.entries(
      parse<Record<string, { open: string; close: string }[]>>(v["hours.weekly"], {}),
    ).filter(([, list]) => Array.isArray(list) && list.length > 0),
  );
  const hours = {
    weekly,
    exceptions: [],
    ...(v["byAppointment"] === "on" ? { byAppointment: true } : {}),
  };
  const photos = parse<{ key: string }[]>(v["photos"], []);
  const lat = Number(v["lat"]);
  const lng = Number(v["lng"]);
  const addressHidden = v["addressHidden"] === "on";
  const card = cardFromDraft(locale, copy, {
    name: pick("name") || labels.unnamed,
    kindName: kind?.name ?? null,
    townName: placeName,
    address: addressHidden ? "" : pick("address"),
    accent,
    icons: v["cardStyle.icons"] === "solid" ? "solid" : "line",
    logoUrl: v["logo"] ? mediaUrl(v["logo"]) : null,
    photoUrls: photos.map((p) => mediaUrl(p.key)),
    phone: v["phone"] ?? "",
    whatsapp: v["whatsapp"] ?? "",
    point: v["lat"] && v["lng"] && !addressHidden ? { lat, lng } : null,
    website: v["website"] ?? "",
    instagram: v["links.instagram"] ?? "",
    facebook: v["links.facebook"] ?? "",
    tiktok: v["links.tiktok"] ?? "",
    hours,
  });
  return (
    <figure
      aria-label={labels.title}
      className={styles.previewCard}
      style={{ margin: 0 }}
      data-live-card=""
    >
      <BusinessCard
        locale={locale}
        copy={copy}
        card={{
          ...card,
          glutenFree: v["glutenFree"] === "on",
          appointment: isByAppointment(hours),
        }}
        renderedAt={read.at}
        preview
      />
    </figure>
  );
}
