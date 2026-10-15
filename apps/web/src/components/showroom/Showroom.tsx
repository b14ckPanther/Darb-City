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
}

/**
 * The live viewer: one real site in one device, opened on request. It runs a single iframe at the
 * device's own width (so the site lays out as it would there), scaled to fit the screen, with the
 * screenshot underneath until the site has loaded.
 */
function Viewer({
  client,
  labels,
  onClose,
}: {
  client: ShowroomClient;
  labels: ShowroomLabels;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // Phones open on the phone: a laptop scaled to 360px is too small to try. The viewer only ever
  // mounts after a tap, so the window is there to ask.
  const [device, setDevice] = useState<Device>(() =>
    window.matchMedia("(max-width: 720px)").matches ? "phone" : "laptop",
  );
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    // Removing the dialog on close ends the modal too; closing here would fire onClose again.
    if (!el.open) el.showModal();
  }, []);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const { w, h } = NATIVE[device];
    const fit = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setScale(Math.min(width / w, height / h, 1));
    });
    fit.observe(el);
    return () => fit.disconnect();
  }, [device]);

  // A new device starts unloaded (reset during render when it changes).
  const [loadedOn, setLoadedOn] = useState(device);
  if (loadedOn !== device) {
    setLoadedOn(device);
    setLoaded(false);
  }

  const { w, h } = NATIVE[device];
  const host = new URL(client.url).hostname;
  return (
    <dialog
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
            <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)}>
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
      <div ref={stage} className={styles.stage}>
        {scale > 0 ? (
          <div
            className={styles.screen}
            data-device={device}
            data-loaded={loaded ? "" : undefined}
            style={{ inlineSize: w * scale, blockSize: h * scale } as CSSProperties}
          >
            <Image
              src={shot(client.id, device)}
              alt=""
              fill
              sizes={`${Math.round(w * scale)}px`}
              className={styles.poster}
            />
            <iframe
              key={`${client.id}-${device}`}
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
      </div>
    </dialog>
  );
}

/**
 * The showroom: one section per project, each a laptop and a phone showing its real screens.
 * Screenshots keep scrolling light; "Try it live" opens the real site in a viewer, one at a time.
 * /showroom#caramel lands on that project.
 */
export function Showroom({
  clients,
  labels,
}: {
  clients: ShowroomClient[];
  labels: ShowroomLabels;
}) {
  const [open, setOpen] = useState<ShowroomClient | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <ol className={styles.cases}>
        {clients.map((c, i) => {
          const alt = labels.shotAlt.replace("{name}", c.name);
          return (
            <li key={c.id} id={c.id} className={styles.case} data-side={i % 2 ? "end" : "start"}>
              <div className={styles.devices}>
                <figure className={styles.laptop}>
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
                </figure>
                <figure className={styles.phone}>
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
                </figure>
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
                  <button
                    type="button"
                    className={styles.try}
                    onClick={(e) => {
                      opener.current = e.currentTarget;
                      setOpen(c);
                    }}
                  >
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
          client={open}
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
