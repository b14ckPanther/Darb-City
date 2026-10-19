"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminBusinessDto } from "@darb/contracts";
import type { LatLng } from "@darb/core";
import type { QuickEditorProps } from "@/components/AdminEdit";
import { LocationPicker } from "@/components/LocationPicker";
import { AdminIcon } from "../AdminIcon";
import { at, type AdminKey } from "../copy";
import { HoursEditor } from "../HoursEditor";
import type { LocateAnswer } from "../locate-actions";
import { PlaceFinder } from "../PlaceFinder";
import { pinLabels } from "../pin-labels";
import { QUICK_LINKS, type QuickInput } from "../quick-form";
import { adminHref } from "../routes";
import styles from "./quick.module.css";

/** Found by the bundle budget in this chunk's code: it must never load with a public page. */
export const QUICK_EDIT_MARKER = "darb:quick-edit-chunk";

type Loaded = { business: AdminBusinessDto; kinds: { id: string; name: string; group: string }[] };
const LANGS = [
  ["he", "langHe", "rtl"],
  ["ar", "langAr", "rtl"],
  ["en", "langEn", "ltr"],
] as const;
const LINK_LABEL: Record<(typeof QUICK_LINKS)[number], AdminKey> = {
  instagram: "fieldInstagram",
  facebook: "fieldFacebook",
  tiktok: "fieldTiktok",
  google: "fieldGoogle",
};

/** Finding the place from the public page goes through the admin's quick API, not an action. */
const locateByFetch = async (input: {
  query: string;
  locale: string;
  placeSlug?: string;
}): Promise<LocateAnswer> => {
  try {
    const res = await fetch("/admin/quick-api/locate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await res.json()) as LocateAnswer;
  } catch {
    return { found: null, reason: "error" };
  }
};

/**
 * The quick editor over a business's public page: the fields admins change most (names, kind,
 * phone and links, hours, address and pin, tagline) and its status. A side panel on wide screens,
 * the whole screen on phones. Saving goes through the admin API, then the page reloads fresh.
 */
export default function QuickEditor({ locale, id, onClose }: QuickEditorProps) {
  const t = (key: AdminKey, vars?: Record<string, string | number>) => at(locale, key, vars);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [data, setData] = useState<Loaded | "error" | "signed-out" | null>(null);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [flyTo, setFlyTo] = useState<{ point: LatLng; key: number } | null>(null);
  const [state, setState] = useState<{ busy: boolean; message: string; ok: boolean }>({
    busy: false,
    message: "",
    ok: true,
  });

  useEffect(() => {
    dialog.current?.showModal();
    let live = true;
    fetch(`/admin/quick-api/business?id=${encodeURIComponent(id)}&locale=${locale}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!live) return;
        if (res.status === 401 || res.status === 403) return setData("signed-out");
        if (!res.ok) return setData("error");
        const loaded = (await res.json()) as Loaded;
        setData(loaded);
        setPoint({ lat: loaded.business.lat, lng: loaded.business.lng });
      })
      .catch(() => live && setData("error"));
    return () => {
      live = false;
    };
  }, [id, locale]);

  const field = (name: string) =>
    (form.current?.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";
  const read = (): QuickInput => {
    const loc = (key: string) => Object.fromEntries(LANGS.map(([l]) => [l, field(`${key}.${l}`)]));
    let weekly: QuickInput["weekly"] = {};
    try {
      weekly = JSON.parse(field("hours.weekly") || "{}") as QuickInput["weekly"];
    } catch {
      // The hours editor always writes JSON; keep the hours if not.
    }
    return {
      name: loc("name"),
      tagline: loc("tagline"),
      address: loc("address"),
      primaryKindId: field("primaryKindId"),
      phone: field("phone"),
      whatsapp: field("whatsapp"),
      website: field("website"),
      links: Object.fromEntries(QUICK_LINKS.map((k) => [k, field(`links.${k}`)])),
      weekly,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
    };
  };

  const post = async (action: "save" | "status", body: object) => {
    setState({ busy: true, message: "", ok: true });
    try {
      const res = await fetch(`/admin/quick-api/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const out = (await res.json().catch(() => ({}))) as {
        errors?: string[];
        message?: string | string[];
      };
      if (!res.ok) {
        const why = out.errors?.join(" · ") ?? (typeof out.message === "string" ? out.message : "");
        setState({ busy: false, ok: false, message: `${t("errorGeneric")} ${why}`.trim() });
        return false;
      }
      setState({ busy: false, ok: true, message: t("quickSaved") });
      // The API dropped the page's cached copy: load it fresh.
      window.location.reload();
      return true;
    } catch {
      setState({ busy: false, ok: false, message: t("errorGeneric") });
      return false;
    }
  };

  const b = typeof data === "object" && data ? data.business : null;
  return (
    <dialog
      ref={dialog}
      className={styles.panel}
      aria-labelledby="quick-title"
      onClose={onClose}
      data-quick-editor={QUICK_EDIT_MARKER}
    >
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>{t("quickEyebrow")}</p>
          <h2 id="quick-title" className={styles.title}>
            {b ? (
              <bdi>{b.name[locale] || b.name.he || b.name.ar || b.name.en}</bdi>
            ) : (
              t("quickTitle")
            )}
          </h2>
        </div>
        <button
          type="button"
          className={styles.icon}
          onClick={() => dialog.current?.close()}
          aria-label={t("close")}
        >
          <AdminIcon name="close" />
        </button>
      </header>

      {data === null ? (
        <p className={styles.note} role="status">
          {t("paletteSearching")}
        </p>
      ) : data === "error" || data === "signed-out" ? (
        <p className={styles.error} role="alert">
          {t(data === "error" ? "errorGeneric" : "quickSignIn")}{" "}
          <a href={adminHref(locale, "/sign-in")}>{t("signIn")}</a>
        </p>
      ) : (
        <>
          <div className={styles.quick}>
            <span className={styles.status} data-status={data.business.status}>
              {t(
                data.business.status === "published"
                  ? "statusPublished"
                  : data.business.status === "draft"
                    ? "statusDraft"
                    : "statusSuspended",
              )}
            </span>
            {data.business.status === "published" ? (
              <button
                type="button"
                className={styles.ghost}
                disabled={state.busy}
                onClick={() => {
                  if (window.confirm(t("confirmToDraft"))) void post("status", { status: "draft" });
                }}
              >
                {t("quickUnpublish")}
              </button>
            ) : (
              <button
                type="button"
                className={styles.ghost}
                disabled={state.busy}
                onClick={() => void post("status", { status: "published" })}
              >
                {t("publish")}
              </button>
            )}
            <button
              type="button"
              className={styles.ghost}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setState({ busy: false, ok: true, message: t("quickCopied") });
                } catch {
                  setState({ busy: false, ok: false, message: t("quickNotCopied") });
                }
              }}
            >
              <AdminIcon name="copy" size={16} />
              {t("quickCopy")}
            </button>
            <a className={styles.ghost} href={adminHref(locale, `/businesses/${id}`)}>
              <AdminIcon name="external" size={16} />
              {t("quickOpenAdmin")}
            </a>
          </div>

          <form
            ref={form}
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void post("save", { input: read() });
            }}
            noValidate
          >
            <fieldset className={styles.group}>
              <legend>{t("fieldName")}</legend>
              <div className={styles.three}>
                {LANGS.map(([l, key, dir]) => (
                  <label key={l} className={styles.field}>
                    <span>
                      <span className={styles.sr}>{t("fieldName")} · </span>
                      {t(key)}
                    </span>
                    <input name={`name.${l}`} defaultValue={b!.name[l] ?? ""} dir={dir} />
                  </label>
                ))}
              </div>
            </fieldset>
            <label className={styles.field}>
              <span>{t("fieldPrimaryKind")}</span>
              <select name="primaryKindId" defaultValue={b!.primaryKindId}>
                {[...new Set(data.kinds.map((k) => k.group))].map((g) => (
                  <optgroup key={g} label={g}>
                    {data.kinds
                      .filter((k) => k.group === g)
                      .map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className={styles.two}>
              {(["phone", "whatsapp"] as const).map((k) => (
                <label key={k} className={styles.field}>
                  <span>{t(k === "phone" ? "fieldPhone" : "fieldWhatsapp")}</span>
                  <input name={k} type="tel" defaultValue={b![k] ?? ""} dir="ltr" />
                </label>
              ))}
            </div>
            <label className={styles.field}>
              <span>{t("fieldWebsite")}</span>
              <input name="website" type="url" defaultValue={b!.website ?? ""} dir="ltr" />
            </label>
            <div className={styles.two}>
              {QUICK_LINKS.map((k) => (
                <label key={k} className={styles.field}>
                  <span>{t(LINK_LABEL[k])}</span>
                  <input name={`links.${k}`} defaultValue={b!.links[k] ?? ""} dir="ltr" />
                </label>
              ))}
            </div>

            <fieldset className={styles.group}>
              <legend>{t("secLocation")}</legend>
              <PlaceFinder
                locale={locale}
                placeSlug={() => b!.placeSlug}
                locate={locateByFetch}
                onFound={(p) => {
                  setPoint(p);
                  setFlyTo((f) => ({ point: p, key: (f?.key ?? 0) + 1 }));
                }}
                canFillAddress={(lang) => !field(`address.${lang}`).trim()}
                onFillAddress={(lang, address) => {
                  const el = form.current?.elements.namedItem(`address.${lang}`);
                  if (el instanceof HTMLInputElement) el.value = address;
                }}
              />
              <LocationPicker
                value={point}
                onChange={setPoint}
                locale={locale}
                flyTo={flyTo}
                labels={pinLabels(locale)}
                names={{ lat: "quick-lat", lng: "quick-lng" }}
              />
              <div className={styles.three}>
                {LANGS.map(([l, key, dir]) => (
                  <label key={l} className={styles.field}>
                    <span>
                      <span className={styles.sr}>{t("fieldAddress")} · </span>
                      {t(key)}
                    </span>
                    <input name={`address.${l}`} defaultValue={b!.address[l] ?? ""} dir={dir} />
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend>{t("secHours")}</legend>
              <HoursEditor
                weekly={b!.hours.weekly}
                labels={{
                  days: (["day0", "day1", "day2", "day3", "day4", "day5", "day6"] as const).map(
                    (d) => t(d),
                  ),
                  closed: t("closed"),
                  add: t("addHours"),
                  remove: t("remove"),
                  open: t("opens"),
                  close: t("closes"),
                }}
              />
            </fieldset>

            <fieldset className={styles.group}>
              <legend>{t("fieldTagline")}</legend>
              <div className={styles.three}>
                {LANGS.map(([l, key, dir]) => (
                  <label key={l} className={styles.field}>
                    <span>
                      <span className={styles.sr}>{t("fieldTagline")} · </span>
                      {t(key)}
                    </span>
                    <input name={`tagline.${l}`} defaultValue={b!.tagline[l] ?? ""} dir={dir} />
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.bar}>
              <p
                className={state.ok ? styles.note : styles.error}
                role={state.ok ? "status" : "alert"}
                data-quick-status=""
              >
                {state.message}
              </p>
              <button type="submit" className={styles.save} disabled={state.busy}>
                {t("save")}
              </button>
            </div>
          </form>
        </>
      )}
    </dialog>
  );
}
