"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
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
import { PlaceFinder, scriptOf } from "../PlaceFinder";
import type { locatePlace } from "../locate-actions";
import { adminHref } from "../routes";
import { downscale } from "./photo";
import { flushQueue, openQueue, type QueueStore, type QueuedCapture } from "./queue";
import styles from "../admin.module.css";
import { buzz, takeSharedPhoto } from "./quick";
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

/**
 * The helper app's quick add: the camera is the one big action, everything the sign fills in is
 * there to check, the rest folds away, and sending resets for the next shop at once.
 */
export interface QuickAdd {
  /** Added today so far, and the day's cap (null: no cap, an admin). */
  today: number;
  limit: number | null;
  /** Opened from a home screen shortcut (camera) or from something shared into the app. */
  incoming?: { camera?: boolean; photo?: boolean; link?: string | null; name?: string | null };
  /** Shown under the steps while nothing is being added (the install card). */
  aside?: ReactNode;
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
  matchLinks = "admin",
  distinct: needsDistinct = false,
  quick,
}: {
  locale: Locale;
  kinds: StreetKind[];
  reading: boolean;
  uploads: boolean;
  /** Where the phone's calls go: /admin/field-api by default, /helpers/field-api for helpers. */
  base?: string;
  /** How the place finder asks (the admin's server action by default). */
  locate?: typeof locatePlace;
  /** A likely duplicate links to the admin's business page, or (helpers) to nothing. */
  matchLinks?: "admin" | "none";
  /** A helper must say how it differs to save past a strong match (the API insists too). */
  distinct?: boolean;
  /** The helper app's phone-first layout (the admin keeps the full form). */
  quick?: QuickAdd;
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
  const linkOf = (m: FieldMatchDto) =>
    matchLinks === "admin" ? adminHref(locale, `/businesses/${m.id}`) : null;
  const camera = useRef<HTMLInputElement>(null);
  const dupHeading = useRef<HTMLHeadingElement>(null);
  const store = useRef<QueueStore | null>(null);
  const flushing = useRef(false);

  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading>({ state: "idle" });
  const [suggested, setSuggested] = useState<FieldReadingDto | null>(null);
  // A name shared into the helper app goes into the field for its letters.
  const [names, setNames] = useState<Names>(() =>
    quick?.incoming?.name
      ? { ...EMPTY, [scriptOf(quick.incoming.name)]: quick.incoming.name }
      : EMPTY,
  );
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
  // Quick add only: the form opens with a photo (or by hand); the map and the extras fold away.
  const incoming = quick?.incoming;
  const sharedLink = incoming?.link ?? null;
  const [manual, setManual] = useState(Boolean(incoming?.link || incoming?.name));
  const [mapOpen, setMapOpen] = useState(false);
  const [otherNames, setOtherNames] = useState(false);
  const [added, setAdded] = useState(quick?.today ?? 0);
  const [toast, setToast] = useState<{ text: string; kind: "sent" | "kept"; n: number } | null>(
    null,
  );
  const [connected, setConnected] = useState(true);
  const [linkMissed, setLinkMissed] = useState(false);
  const [shared, setShared] = useState(Boolean(incoming?.link || incoming?.name));
  const today = Math.max(quick?.today ?? 0, added);
  useEffect(() => {
    if (!toast) return;
    const gone = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(gone);
  }, [toast]);
  useEffect(() => {
    if (!quick) return;
    const sync = () => setConnected(online());
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [quick]);

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
    // The location is asked for as the screen opens: the admin is standing at the shop. A shared
    // map link places the pin itself (the phone's location only if the link gives none).
    const asked = setTimeout(sharedLink ? () => undefined : locate, 0);
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
  }, [locate, flush, sharedLink]);

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

  // Opened from a shortcut or a share: once, then the address bar loses the query.
  const handled = useRef(false);
  const onPhotoRef = useRef(onPhoto);
  useEffect(() => {
    onPhotoRef.current = onPhoto;
  });
  useEffect(() => {
    if (!incoming || handled.current) return;
    handled.current = true;
    if (incoming.camera || incoming.photo || incoming.link || incoming.name)
      window.history.replaceState(null, "", window.location.pathname);
    if (incoming.photo)
      void takeSharedPhoto().then((file) => {
        if (file) void onPhotoRef.current(file);
      });
    else if (incoming.camera) camera.current?.click();
    if (incoming.link && finder !== undefined) {
      void finder({ query: incoming.link, locale }).then((answer) => {
        const hit = answer.found;
        if (hit) {
          setPoint(hit.point);
          setAccuracy(null);
          setFlyTo((f) => ({ point: hit.point, key: (f?.key ?? 0) + 1 }));
        } else {
          setLinkMissed(true);
          setMapOpen(true);
          locate();
        }
      });
    }
  }, [incoming, finder, locale, locate]);

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
    setManual(false);
    setMapOpen(false);
    setOtherNames(false);
    setLinkMissed(false);
    setShared(false);
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
    if (missing.length || !point) {
      buzz(40);
      if (!point) setMapOpen(true);
      if (!kind || !Object.values(names).some((v) => v.trim())) setOtherNames(true);
      return;
    }

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
            buzz([30, 60, 30]);
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
      buzz(40);
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
    if (quick) {
      // Reset at once and say so; the queue sends in the background.
      const n = today + 1;
      setAdded(n);
      buzz(online() ? [20, 50, 20] : 20);
      setToast(
        online()
          ? { text: t("quickSent", { count: n }), kind: "sent", n }
          : { text: t("quickKept"), kind: "kept", n },
      );
    } else setMessage(t("streetQueued"));
    await flush();
    const still = s ? (await s.all()).find((i) => i.clientId === item.clientId) : item;
    const left = Boolean(still);
    if (quick) {
      // Still on the phone: waiting for a connection, or held back (the list below says why).
      if (still)
        setToast((v) =>
          v?.kind !== "sent"
            ? v
            : still.state === "waiting"
              ? { ...v, text: t("quickKept"), kind: "kept" }
              : null,
        );
    } else setMessage(t(left ? "streetQueued" : "streetSaved"));
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

  const cameraIcon = (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" focusable="false">
      <path
        fill="currentColor"
        d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      />
    </svg>
  );
  const cameraInput = (
    <input
      ref={camera}
      type="file"
      accept="image/*"
      capture="environment"
      className={own.cameraInput}
      onChange={(e) => void onPhoto(e.target.files?.[0])}
    />
  );
  const readingNote =
    reading.state === "reading" ? (
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
    ) : null;
  const nameField = ([l, letters, dir]: (typeof LETTERS)[number]) => (
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
  );
  const phoneAndKind = (
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
        <select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value)} required>
          <option value="">{t("streetKindPick")}</option>
          {kinds.map((k) => (
            <option key={k.slug} value={k.slug}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
  const accuracyText = locating
    ? t("streetLocating")
    : noLocation && !point
      ? t("streetNoLocation")
      : accuracy !== null
        ? `${t("streetAccuracy", { metres: accuracy })}${rough ? `. ${t("streetAccuracyWeak")}` : ""}`
        : "";
  const finderAndMap = (
    <>
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
    </>
  );
  const extras = (
    <>
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
    </>
  );
  const duplicates = dupList.length ? (
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
  ) : null;
  const errorList = errors.length ? (
    <ul className={styles.error} role="alert">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  ) : null;
  const queueList = queue.length ? (
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
  ) : null;

  if (quick) {
    const open = Boolean(preview) || manual;
    const showMap = mapOpen || rough || (noLocation && !point) || linkMissed;
    const shownNames = LETTERS.filter(([l]) => otherNames || l === locale || names[l].trim());
    const hiddenNames = LETTERS.length - shownNames.length;
    const progress = quick.limit ? Math.min(1, today / quick.limit) : null;
    return (
      <div className={own.quick} data-quick={open ? "check" : "start"}>
        <p className={styles.srOnly} role="status" aria-live="polite">
          {reading.state === "reading" ? t("streetReading") : ""}
        </p>
        <div className={own.toastSlot} role="status" aria-live="polite">
          {toast ? (
            <p key={toast.n} className={own.toast} data-kind={toast.kind}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
                {toast.kind === "sent" ? (
                  <path
                    d="M5 12.5 10 17.5 19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path
                    d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <span>{toast.text}</span>
            </p>
          ) : null}
        </div>
        {!connected ? <p className={own.offline}>{t("quickOffline")}</p> : null}
        {!persistent ? <p className={styles.warning}>{t("streetNoStorage")}</p> : null}

        <div className={own.today}>
          <span>
            {quick.limit
              ? t("quickToday", { count: today, limit: quick.limit })
              : t("quickTodayOpen", { count: today })}
          </span>
          {progress !== null ? (
            <span className={own.meter} aria-hidden="true">
              <span style={{ transform: `scaleX(${progress})` }} />
            </span>
          ) : null}
        </div>

        {open ? (
          <>
            <section className={own.shot} aria-labelledby={`${id}-sign`}>
              <h2 id={`${id}-sign`} className={styles.srOnly}>
                {t("streetSign")}
              </h2>
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local object URL, never optimised
                <img className={own.thumb} src={preview} alt={t("streetPhotoAlt")} />
              ) : (
                <span className={own.thumbEmpty} aria-hidden="true">
                  {cameraIcon}
                </span>
              )}
              <div className={own.shotText}>
                {shared ? <p className={styles.hint}>{t("quickShared")}</p> : null}
                {readingNote}
                <label className={own.retake}>
                  {cameraInput}
                  {t(preview ? "streetRetake" : "streetTakePhoto")}
                </label>
              </div>
            </section>

            <form className={own.form} onSubmit={(e) => void save(e)} noValidate>
              <h2 className={own.checkTitle}>{t("quickCheckTitle")}</h2>
              <fieldset className={own.group}>
                <legend className={styles.srOnly}>{t("streetNames")}</legend>
                {shownNames.map(nameField)}
                {hiddenNames > 0 ? (
                  <button
                    type="button"
                    className={own.more}
                    aria-expanded="false"
                    onClick={() => setOtherNames(true)}
                  >
                    + {t("quickMoreNames")}
                  </button>
                ) : null}
              </fieldset>
              {phoneAndKind}

              <fieldset className={own.group}>
                <legend className={styles.srOnly}>{t("streetLocation")}</legend>
                <div className={own.pinRow}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
                    <path
                      fill="currentColor"
                      d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
                    />
                  </svg>
                  <div className={own.pinText}>
                    <strong>
                      {point
                        ? t(accuracy !== null ? "quickPinned" : "quickPinnedMap")
                        : t("streetLocation")}
                    </strong>
                    <span className={rough ? own.pinWarn : undefined} aria-live="polite">
                      {linkMissed ? t("quickLinkMissed") : accuracyText}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={own.pinButton}
                    aria-expanded={showMap}
                    onClick={() => setMapOpen(!showMap)}
                  >
                    {t(showMap ? "quickPinDone" : "quickMovePin")}
                  </button>
                </div>
                {showMap ? <div className={own.mapBox}>{finderAndMap}</div> : null}
              </fieldset>

              <details className={own.extras}>
                <summary>{t("quickMore")}</summary>
                <div className={own.extrasBody}>{extras}</div>
              </details>

              {duplicates}
              {errorList}
              {!uploads ? <p className={styles.hint}>{t("streetUploadsOff")}</p> : null}
              <div className={own.dock}>
                <button type="button" className={own.discard} onClick={reset}>
                  {t("quickDiscard")}
                </button>
                <button type="submit" className={own.send} disabled={checking}>
                  {t(
                    strong
                      ? "streetSaveDistinct"
                      : dupList.length
                        ? "quickSendAnyway"
                        : "quickSend",
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <section className={own.hero} aria-labelledby={`${id}-hero`}>
              <span className={own.heroIcon} aria-hidden="true">
                {cameraIcon}
              </span>
              <h2 id={`${id}-hero`} className={own.heroTitle}>
                {t("quickHeroTitle")}
              </h2>
              <p className={own.heroLead}>{t("quickHeroLead")}</p>
              <ol className={own.steps}>
                <li data-on="">{t("quickStepPhoto")}</li>
                <li>{t("quickStepCheck")}</li>
                <li>{t("quickStepSend")}</li>
              </ol>
            </section>
            {quick.aside}
            {queueList}
            <div className={own.dock} data-start="">
              <label className={own.shoot}>
                {cameraInput}
                {cameraIcon}
                <span>{t("streetTakePhoto")}</span>
              </label>
              <button type="button" className={own.manual} onClick={() => setManual(true)}>
                {t("quickManual")}
              </button>
            </div>
          </>
        )}
        {open ? queueList : null}
      </div>
    );
  }

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
          {cameraInput}
          {cameraIcon}
          <span>{t(preview ? "streetRetake" : "streetTakePhoto")}</span>
        </label>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL, never optimised
          <img className={own.preview} src={preview} alt={t("streetPhotoAlt")} />
        ) : null}
        {readingNote}
      </section>

      <form className={own.form} onSubmit={(e) => void save(e)} noValidate>
        <fieldset className={own.group}>
          <legend className={own.legend}>{t("streetNames")}</legend>
          {LETTERS.map(nameField)}
        </fieldset>
        {phoneAndKind}

        <fieldset className={own.group}>
          <legend className={own.legend}>{t("streetLocation")}</legend>
          <p className={rough ? styles.warning : styles.hint} aria-live="polite">
            {accuracyText}
          </p>
          {finderAndMap}
        </fieldset>

        {extras}
        {duplicates}
        {errorList}
        <button type="submit" className={`${styles.primary} ${own.save}`} disabled={checking}>
          {t(strong ? "streetSaveDistinct" : dupList.length ? "streetSaveAnyway" : "streetSave")}
        </button>
      </form>

      {queueList}
    </div>
  );
}
