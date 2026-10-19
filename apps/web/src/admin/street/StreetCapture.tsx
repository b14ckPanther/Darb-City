"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  isStrongMatch,
  type FieldMatchDto,
  type FieldReadResultDto,
  type FieldReadingDto,
} from "@darb/contracts";
import { pickText, type LatLng, type Locale } from "@darb/core";
import { LocationPicker } from "@/components/LocationPicker";
import { at, type AdminKey } from "../copy";
import { PlaceFinder } from "../PlaceFinder";
import type { locatePlace } from "../locate-actions";
import { adminHref } from "../routes";
import { downscale } from "./photo";
import { flushQueue, openQueue, type QueueStore, type QueuedCapture } from "./queue";
import styles from "../admin.module.css";
import own from "./street.module.css";

export interface StreetKind {
  slug: string;
  label: string;
}

type Names = { he: string; ar: string; en: string };
const EMPTY: Names = { he: "", ar: "", en: "" };
const LETTERS = [
  ["he", "א ב ג", "rtl"],
  ["ar", "أ ب ت", "rtl"],
  ["en", "A B C", "ltr"],
] as const;
/** The phone's location is "rough" past this: the admin is asked to nudge the pin. */
const ROUGH_METRES = 40;
const PHONE = /^\+?[0-9][0-9 ()-]{5,19}$/;

type Reading =
  | { state: "idle" }
  | { state: "reading" }
  | { state: "done"; confidence: number | null }
  | { state: "none"; key: AdminKey };

const REASON_KEY: Record<NonNullable<FieldReadResultDto["reason"]>, AdminKey> = {
  off: "streetReadOff",
  budget: "streetReadBudget",
  excluded: "streetReadExcluded",
  unreadable: "streetReadUnreadable",
};

/** A v4 UUID; randomUUID needs a secure context, which a phone on a LAN address is not. */
function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const online = () => typeof navigator === "undefined" || navigator.onLine !== false;

/**
 * Add from the street: photograph the sign, let it be read, check, save, next. Every capture is
 * queued on the phone first and sent when it can be; nothing here publishes anything. The admin's
 * screen and the helper app draw this same form; the helper app passes its own routes.
 */
export function StreetCapture({
  locale,
  kinds,
  reading: readingOn,
  uploads,
  base: baseProp,
  locate: finder,
  matchHref,
  distinct: needsDistinct = false,
}: {
  locale: Locale;
  kinds: StreetKind[];
  reading: boolean;
  uploads: boolean;
  /** Where the phone's calls go: /admin/field-api by default, /helpers/field-api for helpers. */
  base?: string;
  /** How the place finder asks (the admin's server action by default). */
  locate?: typeof locatePlace;
  /** Where a likely duplicate links: the admin's business page by default; null for no link. */
  matchHref?: (m: FieldMatchDto) => string | null;
  /** A helper must say how it differs to save past a strong match (the API insists too). */
  distinct?: boolean;
}) {
  const t = (key: AdminKey, vars?: Record<string, string | number>) => at(locale, key, vars);
  const router = useRouter();
  // Read through a ref: the effects below must run once, whatever the router object is.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  });
  const id = useId();
  const base = baseProp ?? adminHref(locale, "/field-api");
  const linkOf = matchHref ?? ((m: FieldMatchDto) => adminHref(locale, `/businesses/${m.id}`));
  const camera = useRef<HTMLInputElement>(null);
  const dupHeading = useRef<HTMLHeadingElement>(null);
  const store = useRef<QueueStore | null>(null);
  const flushing = useRef(false);

  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading>({ state: "idle" });
  const [suggested, setSuggested] = useState<FieldReadingDto | null>(null);
  const [names, setNames] = useState<Names>(EMPTY);
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState("");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [different, setDifferent] = useState("");
  const [point, setPoint] = useState<LatLng | null>(null);
  const [flyTo, setFlyTo] = useState<{ point: LatLng; key: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [noLocation, setNoLocation] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [matches, setMatches] = useState<{ key: string; list: FieldMatchDto[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [queue, setQueue] = useState<QueuedCapture[]>([]);
  const [persistent, setPersistent] = useState(true);
  /** Bumped when likely duplicates turn up: their heading takes the focus once it is drawn. */
  const [focusDup, setFocusDup] = useState(0);
  useEffect(() => {
    if (focusDup) dupHeading.current?.focus();
  }, [focusDup]);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNoLocation(true);
      return;
    }
    setLocating(true);
    setNoLocation(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(Math.round(pos.coords.accuracy));
      },
      () => {
        setLocating(false);
        setNoLocation(true);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }, []);

  const flush = useCallback(async () => {
    const s = store.current;
    if (!s || flushing.current) return;
    flushing.current = true;
    try {
      const { sent } = await flushQueue({ fetch: (...a) => fetch(...a), base, store: s }, setQueue);
      if (sent > 0) routerRef.current.refresh();
    } finally {
      flushing.current = false;
      setQueue(await s.all());
    }
  }, [base]);

  useEffect(() => {
    // The location is asked for as the screen opens: the admin is standing at the shop.
    const asked = setTimeout(locate, 0);
    let gone = false;
    void openQueue().then(async (s) => {
      if (gone) return;
      store.current = s;
      setPersistent(s.persistent);
      setQueue(await s.all());
      void flush();
    });
    const back = () => void flush();
    window.addEventListener("online", back);
    return () => {
      gone = true;
      clearTimeout(asked);
      window.removeEventListener("online", back);
    };
  }, [locate, flush]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  /** Fills only what the admin has not typed yet. */
  const apply = (r: FieldReadingDto) => {
    setSuggested(r);
    setNames((n) => ({
      he: n.he || r.name.he || "",
      ar: n.ar || r.name.ar || "",
      en: n.en || r.name.en || "",
    }));
    if (r.phone) setPhone((p) => p || r.phone!);
    if (r.kindSlug && kinds.some((k) => k.slug === r.kindSlug)) setKind((k) => k || r.kindSlug!);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setMessage("");
    const small = await downscale(file);
    setPhoto(small);
    setPreview(URL.createObjectURL(small));
    if (!readingOn) {
      setReading({ state: "none", key: "streetReadOff" });
      return;
    }
    if (!online()) {
      setReading({ state: "none", key: "streetReadOffline" });
      return;
    }
    setReading({ state: "reading" });
    try {
      const form = new FormData();
      form.append("file", small, "sign.jpg");
      const res = await fetch(`${base}/read`, { method: "POST", body: form });
      const body = (await res.json()) as FieldReadResultDto;
      if (res.ok && body.reading) {
        apply(body.reading);
        setReading({ state: "done", confidence: body.reading.confidence });
      } else
        setReading({
          state: "none",
          key: body.reason ? REASON_KEY[body.reason] : "streetReadUnreadable",
        });
    } catch {
      setReading({ state: "none", key: online() ? "streetReadUnreadable" : "streetReadOffline" });
    }
  };

  const dupKey = () => JSON.stringify([names, phone.trim(), point]);

  const reset = () => {
    setPhoto(null);
    setPreview(null);
    setReading({ state: "idle" });
    setSuggested(null);
    setNames(EMPTY);
    setPhone("");
    setKind("");
    setHours("");
    setNote("");
    setDifferent("");
    setMatches(null);
    setErrors([]);
    if (camera.current) camera.current.value = "";
    locate();
    camera.current?.focus();
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    const missing: string[] = [];
    if (!Object.values(names).some((v) => v.trim())) missing.push(t("streetNameNeeded"));
    if (!kind) missing.push(t("streetKindPick"));
    if (!point) missing.push(t("streetPointNeeded"));
    if (phone.trim() && !PHONE.test(phone.trim())) missing.push(t("streetPhoneBad"));
    setErrors(missing);
    if (missing.length || !point) return;

    const key = dupKey();
    if (matches?.key !== key && online()) {
      setChecking(true);
      try {
        const res = await fetch(`${base}/duplicates`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lat: point.lat,
            lng: point.lng,
            name: names,
            phone: phone.trim() || undefined,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const list = ((await res.json()) as { matches: FieldMatchDto[] }).matches;
          setMatches({ key, list });
          if (list.length) {
            setChecking(false);
            setFocusDup((n) => n + 1);
            return;
          }
        }
      } catch {
        // No answer: the review queue still catches a duplicate.
      }
      setChecking(false);
    }

    // Past a strong match a helper must say how this is another place (the API refuses otherwise).
    const strongNow =
      needsDistinct && (matches?.key === key ? matches.list : []).some(isStrongMatch);
    if (strongNow && different.trim().length < 3) {
      setErrors([t("streetDistinctNeeded")]);
      return;
    }
    const label = pickText(
      Object.fromEntries(Object.entries(names).filter(([, v]) => v.trim())),
      locale,
    );
    const noteText = [hours.trim() ? `${t("streetHours")}: ${hours.trim()}` : "", note.trim()]
      .filter(Boolean)
      .join("\n");
    const item: QueuedCapture = {
      clientId: uuid(),
      createdAt: new Date().toISOString(),
      label,
      photo,
      photoKey: null,
      state: "waiting",
      body: {
        clientId: "",
        name: {
          ...(names.he.trim() ? { he: names.he.trim() } : {}),
          ...(names.ar.trim() ? { ar: names.ar.trim() } : {}),
          ...(names.en.trim() ? { en: names.en.trim() } : {}),
        },
        phone: phone.trim() || null,
        kindSlug: kind,
        lat: point.lat,
        lng: point.lng,
        accuracy,
        ...(noteText ? { note: noteText.slice(0, 1000) } : {}),
        reading: suggested,
        ...(strongNow ? { distinct: different.trim().slice(0, 300) } : {}),
        capturedAt: new Date().toISOString(),
        locale,
      },
    };
    item.body.clientId = item.clientId;
    const s = store.current;
    if (s) {
      await s.put(item);
      setQueue(await s.all());
    }
    reset();
    setMessage(t("streetQueued"));
    await flush();
    const left = s ? (await s.all()).some((i) => i.clientId === item.clientId) : true;
    setMessage(t(left ? "streetQueued" : "streetSaved"));
  };

  const remove = async (clientId: string) => {
    const s = store.current;
    if (!s) return;
    await s.remove(clientId);
    setQueue(await s.all());
  };

  const rough = accuracy !== null && accuracy > ROUGH_METRES;
  const dupList = matches && matches.key === dupKey() ? matches.list : [];
  const strong = needsDistinct && dupList.some(isStrongMatch);
  const stateText = (q: QueuedCapture) =>
    q.state === "sending"
      ? t("streetQueueSending")
      : q.state === "refused"
        ? t("streetQueueRefused", { reason: q.error ?? "" })
        : q.state === "failed"
          ? t("streetQueueFailed")
          : q.state === "limited"
            ? t("streetQueueLimit")
            : t("streetQueueWaiting");

  return (
    <div className={own.layout}>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {reading.state === "reading" ? t("streetReading") : message}
      </p>
      {!persistent ? <p className={styles.warning}>{t("streetNoStorage")}</p> : null}
      {!uploads ? <p className={styles.hint}>{t("streetUploadsOff")}</p> : null}

      <section className={own.capture} aria-labelledby={`${id}-sign`}>
        <h2 id={`${id}-sign`} className={styles.srOnly}>
          {t("streetSign")}
        </h2>
        <label className={own.camera}>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className={own.cameraInput}
            onChange={(e) => void onPhoto(e.target.files?.[0])}
          />
          <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" focusable="false">
            <path
              fill="currentColor"
              d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
            />
          </svg>
          <span>{t(preview ? "streetRetake" : "streetTakePhoto")}</span>
        </label>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL, never optimised
          <img className={own.preview} src={preview} alt={t("streetPhotoAlt")} />
        ) : null}
        {reading.state === "reading" ? (
          <p className={`${styles.notice} ${own.reading}`} aria-hidden="true">
            {t("streetReading")}
          </p>
        ) : reading.state === "done" ? (
          <p className={styles.notice}>
            {t("streetReadDone")}
            {reading.confidence !== null ? (
              <>
                {" "}
                <span className={styles.hint}>
                  {t("streetReadSure", { percent: Math.round(reading.confidence * 100) })}
                </span>
              </>
            ) : null}
          </p>
        ) : reading.state === "none" ? (
          <p className={reading.key === "streetReadExcluded" ? styles.warning : styles.hint}>
            {t(reading.key)}
          </p>
        ) : null}
      </section>

      <form className={own.form} onSubmit={(e) => void save(e)} noValidate>
        <fieldset className={own.group}>
          <legend className={own.legend}>{t("streetNames")}</legend>
          {LETTERS.map(([l, letters, dir]) => (
            <label key={l} className={styles.field}>
              <span>{t("streetNameIn", { letters })}</span>
              <input
                lang={l}
                dir={dir}
                value={names[l]}
                autoComplete="off"
                onChange={(e) => setNames((n) => ({ ...n, [l]: e.target.value }))}
              />
            </label>
          ))}
        </fieldset>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>{t("fieldPhone")}</span>
            <input
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          {/* Not a wrapping label: its name would take in every option's text. */}
          <div className={styles.field}>
            <label htmlFor={`${id}-kind`} className={own.label}>
              {t("fieldPrimaryKind")}
            </label>
            <select
              id={`${id}-kind`}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              required
            >
              <option value="">{t("streetKindPick")}</option>
              {kinds.map((k) => (
                <option key={k.slug} value={k.slug}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className={own.group}>
          <legend className={own.legend}>{t("streetLocation")}</legend>
          <p className={rough ? styles.warning : styles.hint} aria-live="polite">
            {locating
              ? t("streetLocating")
              : noLocation && !point
                ? t("streetNoLocation")
                : accuracy !== null
                  ? `${t("streetAccuracy", { metres: accuracy })}${rough ? `. ${t("streetAccuracyWeak")}` : ""}`
                  : ""}
          </p>
          <PlaceFinder
            locale={locale}
            {...(finder ? { locate: finder } : {})}
            onFound={(p) => {
              setPoint(p);
              setAccuracy(null);
              setFlyTo((f) => ({ point: p, key: (f?.key ?? 0) + 1 }));
            }}
          />
          <LocationPicker
            value={point}
            flyTo={flyTo}
            onChange={(p) => {
              setPoint(p);
              setAccuracy(null);
            }}
            locale={locale}
            names={{ lat: "street-lat", lng: "street-lng" }}
            labels={{
              map: t("pinMap"),
              pin: t("pinPin"),
              hint: t("pinHint"),
              centre: t("pinCentre"),
              locate: t("pinLocate"),
              locating: t("pinLocating"),
              noLocation: t("pinNoLocation"),
              outside: t("pinOutside"),
              editNumbers: t("pinEditNumbers"),
              lat: t("fieldLat"),
              lng: t("fieldLng"),
              noMap: t("pinNoMap"),
              mapData: t("pinMapData"),
              gestures: {
                windows: t("pinGestureWindows"),
                mac: t("pinGestureMac"),
                mobile: t("pinGestureMobile"),
              },
            }}
          />
        </fieldset>

        <label className={styles.field}>
          <span>{t("streetHours")}</span>
          <input
            value={hours}
            dir="auto"
            aria-describedby={`${id}-hours`}
            onChange={(e) => setHours(e.target.value)}
          />
          <small id={`${id}-hours`} className={styles.hint}>
            {t("streetHoursHint")}
          </small>
        </label>
        <label className={styles.field}>
          <span>{t("streetNote")}</span>
          <textarea
            value={note}
            dir="auto"
            rows={2}
            className={own.note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {dupList.length ? (
          <section className={styles.warning} aria-labelledby={`${id}-dup`}>
            <h3 id={`${id}-dup`} ref={dupHeading} tabIndex={-1} className={own.dupTitle}>
              {t("streetDupTitle")}
            </h3>
            {strong ? null : (
              <p>{t(dupList.some((m) => linkOf(m)) ? "streetDupHint" : "streetDupHintPlain")}</p>
            )}
            <ul className={own.dupList}>
              {dupList.map((m) => (
                <li key={m.id}>
                  {linkOf(m) ? (
                    <a href={linkOf(m)!} target="_blank" rel="noopener">
                      <bdi>{pickText(m.name, locale) || m.placeSlug}</bdi>
                    </a>
                  ) : (
                    <bdi>{pickText(m.name, locale) || m.placeSlug}</bdi>
                  )}{" "}
                  <span className={styles.hint}>
                    {m.reason === "phone"
                      ? t("streetDupPhone")
                      : t("streetDupName", { metres: m.metres })}
                    {" · "}
                    {t(
                      m.status === "published"
                        ? "statusPublished"
                        : m.status === "draft"
                          ? "statusDraft"
                          : "statusSuspended",
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {strong ? (
              <label className={styles.field}>
                <span>{t("streetDistinct")}</span>
                <textarea
                  value={different}
                  dir="auto"
                  rows={2}
                  maxLength={300}
                  required
                  aria-describedby={`${id}-distinct`}
                  className={own.note}
                  onChange={(e) => setDifferent(e.target.value)}
                />
                <small id={`${id}-distinct`} className={styles.hint}>
                  {t("streetDistinctHint")}
                </small>
              </label>
            ) : null}
          </section>
        ) : null}

        {errors.length ? (
          <ul className={styles.error} role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        <button type="submit" className={`${styles.primary} ${own.save}`} disabled={checking}>
          {t(strong ? "streetSaveDistinct" : dupList.length ? "streetSaveAnyway" : "streetSave")}
        </button>
      </form>

      {queue.length ? (
        <section className={styles.card} aria-labelledby={`${id}-queue`}>
          <div className={styles.actions}>
            <h2 id={`${id}-queue`} className={styles.h2}>
              {t("streetQueue")}
            </h2>
            <button type="button" className={styles.ghost} onClick={() => void flush()}>
              {t("streetRetry")}
            </button>
          </div>
          <ul className={own.queue}>
            {queue.map((q) => (
              <li key={q.clientId} className={own.queueItem}>
                <bdi className={own.queueName}>{q.label}</bdi>
                <span className={q.state === "refused" ? styles.error : styles.hint}>
                  {stateText(q)}
                </span>
                {q.state === "refused" || q.state === "failed" ? (
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => void remove(q.clientId)}
                    aria-label={t("streetRemoveOne", { name: q.label })}
                  >
                    {t("remove")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
