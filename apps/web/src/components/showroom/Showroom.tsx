"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ShowroomClient } from "@/content/showroom";
import styles from "./Showroom.module.css";

type Device = "laptop" | "tablet" | "phone";

/** The viewport each device renders at, before it is scaled into its frame. */
const NATIVE: Record<Device, { w: number; h: number }> = {
  laptop: { w: 1440, h: 900 },
  tablet: { w: 834, h: 1112 },
  phone: { w: 390, h: 844 },
};

/**
 * A device frame running the client's real site in an iframe at the device's own width (so the
 * site lays out as it would there), scaled to fit. The iframe is mounted only for the active client.
 */
function Screen({
  device,
  client,
  title,
  label,
}: {
  device: Device;
  client: ShowroomClient;
  title: string;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / NATIVE[device].w);
    });
    fit.observe(el);
    return () => fit.disconnect();
  }, [device]);

  // A new client starts unloaded (reset during render when the client changes).
  const [loadedFor, setLoadedFor] = useState(client.id);
  if (loadedFor !== client.id) {
    setLoadedFor(client.id);
    setLoaded(false);
  }

  const { w, h } = NATIVE[device];
  return (
    <figure className={styles.device} data-device={device}>
      <div
        ref={box}
        className={styles.screen}
        style={{ aspectRatio: `${w} / ${h}` } as CSSProperties}
        data-loaded={loaded ? "" : undefined}
      >
        {scale > 0 ? (
          <iframe
            key={client.id}
            src={client.url}
            title={title}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onLoad={() => setLoaded(true)}
            style={{ inlineSize: w, blockSize: h, transform: `scale(${scale})` }}
          />
        ) : null}
      </div>
      <figcaption className="visually-hidden">{label}</figcaption>
    </figure>
  );
}

/**
 * The showroom: the client steps scroll on one side while the devices stay in view on the other;
 * whichever step is in the middle of the screen is live in every device. /showroom#caramel opens
 * on that client.
 */
export function Showroom({
  clients,
  labels,
}: {
  clients: ShowroomClient[];
  labels: {
    live: string;
    open: string;
    frameTitle: string;
    devices: Record<Device, string>;
  };
}) {
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLElement | null)[]>([]);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = steps.current.indexOf(entry.target as HTMLElement);
          if (i >= 0) setActive(i);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const el of steps.current) if (el) watch.observe(el);
    const hash = window.location.hash.slice(1);
    const start = clients.findIndex((c) => c.id === hash);
    if (start > 0) steps.current[start]?.scrollIntoView({ block: "center" });
    return () => watch.disconnect();
  }, [clients]);

  const client = clients[active] ?? clients[0]!;
  const title = labels.frameTitle.replace("{name}", client.name);
  return (
    <div className={styles.showroom}>
      <div className={styles.stage} aria-live="polite">
        <p className={styles.now}>
          <span className={styles.pulse} aria-hidden="true" />
          {labels.live} · <bdi>{new URL(client.url).hostname}</bdi>
        </p>
        <div className={styles.devices} data-client={client.id}>
          <Screen device="laptop" client={client} title={title} label={labels.devices.laptop} />
          {wide ? (
            <Screen device="tablet" client={client} title={title} label={labels.devices.tablet} />
          ) : null}
          <Screen device="phone" client={client} title={title} label={labels.devices.phone} />
        </div>
      </div>
      <ol className={styles.steps}>
        {clients.map((c, i) => (
          <li
            key={c.id}
            id={c.id}
            ref={(el) => {
              steps.current[i] = el;
            }}
            className={styles.step}
            data-active={i === active ? "" : undefined}
          >
            <span className={styles.kind}>{c.kind}</span>
            <h2 className={styles.name}>{c.name}</h2>
            <p className={styles.body}>{c.body}</p>
            <ul className={styles.highlights}>
              {c.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <a className={styles.open} href={c.url} target="_blank" rel="noopener">
              {labels.open} <bdi>{new URL(c.url).hostname}</bdi>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
