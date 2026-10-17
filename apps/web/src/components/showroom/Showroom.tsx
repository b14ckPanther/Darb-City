"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ShowroomClient } from "@/content/showroom";
import styles from "./Showroom.module.css";

type Device = "laptop" | "phone";

/** The viewport each device renders at, before it is scaled into its frame. */
const NATIVE: Record<Device, { w: number; h: number }> = {
  laptop: { w: 1440, h: 900 },
  phone: { w: 390, h: 844 },
};

/**
 * On a phone the laptop renders at a small laptop's width (still the site's desktop layout), so
 * it is twice as big once it fits the screen.
 */
const COMPACT_LAPTOP = { w: 1024, h: 640 };

const PHONE_QUERY = "(max-width: 720px)";

/** Android lets a page turn itself sideways in full screen; iOS does not, so this is best effort. */
function goLandscape(el: HTMLElement) {
  void el
    .requestFullscreen?.()
    .then(() =>
      (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })
        .lock?.("landscape")
        .catch(() => {}),
    )
    .catch(() => {});
}

function leaveLandscape() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // Not supported: nothing was locked.
  }
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}

/** Each project's screenshots live in /public/showroom, one per device. */
const shot = (id: string, device: Device) => `/showroom/${id}-${device}.jpg`;

export interface ShowroomLabels {
  live: string;
  open: string;
  tryLive: string;
  close: string;
  loading: string;
  device: string;
  devices: Record<Device, string>;
  frameTitle: string;
  shotAlt: string;
  /** Shown while the laptop lies on its side on an upright phone. */
  turn: string;
}

/**
 * The live viewer: one real site in one device, opened on request. It runs a single iframe at the
 * device's own width (so the site lays out as it would there), scaled to fit the screen, with the
 * screenshot underneath until the site has loaded. On a phone held upright the laptop lies on its
 * side and fills the screen, like a video; turning the phone straightens it.
 */
function Viewer({
  client,
  start,
  labels,
  onClose,
}: {
  client: ShowroomClient;
  start: Device | null;
  labels: ShowroomLabels;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // The viewer only ever mounts after a tap, so the window is there to ask.
  const [phone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
  // Phones open on the phone unless the laptop itself was tapped.
  const [device, setDevice] = useState<Device>(start ?? (phone ? "phone" : "laptop"));
  const [room, setRoom] = useState<{ w: number; h: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    // Removing the dialog on close ends the modal too; closing here would fire onClose again.
    if (!el.open) el.showModal();
    if (phone && device === "laptop") goLandscape(el);
    return leaveLandscape;
    // Only on opening: later device changes go landscape from their own tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = new ResizeObserver(([entry]) => {
      if (entry) setRoom({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    fit.observe(el);
    return () => fit.disconnect();
  }, []);

  // A new device starts unloaded (reset during render when it changes).
  const [loadedOn, setLoadedOn] = useState(device);
  if (loadedOn !== device) {
    setLoadedOn(device);
    setLoaded(false);
  }

  const { w, h } = device === "laptop" && phone ? COMPACT_LAPTOP : NATIVE[device];
  // An upright phone has no room for a laptop: lay it on its side.
  const sideways = phone && device === "laptop" && room !== null && room.h > room.w;
  const scale = room
    ? sideways
      ? Math.min(room.w / h, room.h / w, 1)
      : Math.min(room.w / w, room.h / h, 1)
    : 0;
  const host = new URL(client.url).hostname;
  const pick = (d: Device) => {
    setDevice(d);
    if (phone && d === "laptop" && dialog.current) goLandscape(dialog.current);
    if (d === "phone") leaveLandscape();
  };
  return (
    <dialog data-scheme="night"
      ref={dialog}
      className={styles.viewer}
      aria-label={labels.frameTitle.replace("{name}", client.name)}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop (the dialog itself, not its content) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.bar}>
        <p className={styles.now}>
          <span className={styles.pulse} aria-hidden="true" />
          {client.name} · <bdi>{host}</bdi>
        </p>
        <div className={styles.switch} role="group" aria-label={labels.device}>
          {(Object.keys(NATIVE) as Device[]).map((d) => (
            <button key={d} type="button" aria-pressed={device === d} onClick={() => pick(d)}>
              {labels.devices[d]}
            </button>
          ))}
        </div>
        <div className={styles.barEnd}>
          <a className={styles.ghost} href={client.url} target="_blank" rel="noopener">
            {labels.open}
          </a>
          <button type="button" className={styles.close} onClick={onClose}>
            <span aria-hidden="true">×</span>
            <span className="visually-hidden">{labels.close}</span>
          </button>
        </div>
      </div>
      {/* Left to right inside: the screen is placed and turned by plain geometry. */}
      <div ref={stage} className={styles.stage} dir="ltr">
        {scale > 0 ? (
          <div
            className={styles.screen}
            data-device={device}
            data-loaded={loaded ? "" : undefined}
            style={
              {
                inlineSize: w * scale,
                blockSize: h * scale,
                transform: `translate(-50%, -50%)${sideways ? " rotate(90deg)" : ""}`,
              } as CSSProperties
            }
          >
            <Image
              src={shot(client.id, device)}
              alt=""
              fill
              sizes={`${Math.round(w * scale)}px`}
              className={styles.poster}
            />
            <iframe
              key={`${client.id}-${device}-${w}`}
              src={client.url}
              title={labels.frameTitle.replace("{name}", client.name)}
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onLoad={() => setLoaded(true)}
              style={{ inlineSize: w, blockSize: h, transform: `scale(${scale})` }}
            />
            {loaded ? null : (
              <p className={styles.loading} role="status">
                {labels.loading}
              </p>
            )}
          </div>
        ) : null}
        {sideways ? (
          <p className={styles.turn} aria-hidden="true">
            <span className={styles.turnIcon} />
            {labels.turn}
          </p>
        ) : null}
      </div>
    </dialog>
  );
}

/**
 * The showroom: one section per project, each a laptop and a phone showing its real screens.
 * Screenshots keep scrolling light; "Live" opens the real site in a viewer, one at a time.
 * /showroom#caramel lands on that project.
 */
export function Showroom({
  clients,
  labels,
}: {
  clients: ShowroomClient[];
  labels: ShowroomLabels;
}) {
  const [open, setOpen] = useState<{ client: ShowroomClient; start: Device | null } | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const launch =
    (client: ShowroomClient, start: Device | null) => (e: { currentTarget: HTMLButtonElement }) => {
      opener.current = e.currentTarget;
      setOpen({ client, start });
    };

  return (
    <>
      <ol className={styles.cases}>
        {clients.map((c, i) => {
          const alt = labels.shotAlt.replace("{name}", c.name);
          return (
            <li key={c.id} id={c.id} className={styles.case} data-side={i % 2 ? "end" : "start"}>
              <div className={styles.devices}>
                <button
                  type="button"
                  className={styles.laptop}
                  onClick={launch(c, "laptop")}
                  aria-label={`${labels.tryLive}: ${c.name}, ${labels.devices.laptop}`}
                >
                  <div className={styles.glass}>
                    <Image
                      src={shot(c.id, "laptop")}
                      alt={alt}
                      width={1440}
                      height={900}
                      sizes="(min-width: 1100px) 720px, 92vw"
                      priority={i === 0}
                    />
                  </div>
                </button>
                <button
                  type="button"
                  className={styles.phone}
                  onClick={launch(c, "phone")}
                  aria-label={`${labels.tryLive}: ${c.name}, ${labels.devices.phone}`}
                >
                  <div className={styles.glass}>
                    <Image
                      src={shot(c.id, "phone")}
                      alt=""
                      width={780}
                      height={1688}
                      sizes="(min-width: 1100px) 180px, 28vw"
                      priority={i === 0}
                    />
                  </div>
                </button>
              </div>
              <div className={styles.copy}>
                <span className={styles.kind}>{c.kind}</span>
                <h2 className={styles.name}>{c.name}</h2>
                <p className={styles.body}>{c.body}</p>
                <ul className={styles.highlights}>
                  {c.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <div className={styles.actions}>
                  <button type="button" className={styles.try} onClick={launch(c, null)}>
                    <span className={styles.pulse} aria-hidden="true" />
                    {labels.tryLive}
                  </button>
                  <a className={styles.open} href={c.url} target="_blank" rel="noopener">
                    {labels.open} <bdi>{new URL(c.url).hostname}</bdi>
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {open ? (
        <Viewer
          client={open.client}
          start={open.start}
          labels={labels}
          onClose={() => {
            setOpen(null);
            opener.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
