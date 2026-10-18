import Image from "next/image";
import type { CSSProperties } from "react";
import { pickText, type Locale } from "@darb/core";
import type { ScreenDto } from "@darb/contracts";
import { appPreview } from "@/content/app-preview";
import { showroom } from "@/content/showroom";
import { readableAccent, readableOn } from "@/lib/contrast";
import { LiveDevice } from "./LiveDevice";
import styles from "./AppPreview.module.css";

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

/** The showroom entry (and its screenshots in /public/showroom) for an app, by the app's address. */
export function showroomIdFor(url: string): string | null {
  const h = host(url);
  return showroom.en.clients.find((c) => host(c.url) === h)?.id ?? null;
}

const fill = (template: string, name: string) => template.replace("{name}", name);

/**
 * A business whose app Darb built: its card shows the app itself, in a phone, in the business's
 * own colours, with a way to open it and to try it right here. The screenshot comes from the
 * showroom; an app not in the showroom gets a poster drawn from its own screen.
 */
export function AppPreview({
  locale,
  name,
  url,
  screen,
}: {
  locale: Locale;
  name: string;
  /** The app's address (business.apps.web, already checked to be http(s)). */
  url: string;
  screen: ScreenDto | null;
}) {
  const copy = appPreview[locale];
  const id = showroomIdFor(url);
  const palette = screen?.palette ?? {
    bg: "#0e1b15",
    surface: "#172a21",
    ink: "#f6efe0",
    accent: "#d9a54c",
  };
  const style = {
    "--a-bg": palette.bg,
    "--a-surface": palette.surface,
    "--a-ink": palette.ink,
    "--a-accent": palette.accent,
    "--a-accent-ink": readableAccent(palette.accent, palette.bg, palette.ink),
    "--a-on-accent": readableOn(palette.accent),
    "--a-font": `"${(screen?.font ?? "Heebo").replace(/[^\p{L}\p{N} -]/gu, "")}"`,
  } as CSSProperties;
  return (
    <aside
      className={styles.stage}
      style={style}
      data-app-preview=""
      aria-label={fill(copy.frameTitle, name)}
    >
      <svg
        className={styles.ribbon}
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className={styles.ribbonBody}
          pathLength={1}
          d="M-20 40C80 10 140 120 210 150S330 120 420 260"
        />
        <path
          className={styles.ribbonShine}
          pathLength={1}
          d="M-20 40C80 10 140 120 210 150S330 120 420 260"
        />
      </svg>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>
          <span className={styles.spark} aria-hidden="true" />
          {copy.eyebrow}
        </p>
        <p className={styles.name}>{name}</p>
        {screen ? <p className={styles.tagline}>{pickText(screen.title, locale)}</p> : null}
        <a className={styles.open} href={url} target="_blank" rel="noopener">
          {copy.open}
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </a>
      </div>
      <LiveDevice url={url} title={fill(copy.frameTitle, name)} live={copy.live}>
        {id ? (
          <Image
            className={styles.shot}
            src={`/showroom/${id}-phone.jpg`}
            alt={fill(copy.shotAlt, name)}
            width={780}
            height={1688}
            sizes="180px"
          />
        ) : (
          <span className={styles.poster} role="img" aria-label={fill(copy.shotAlt, name)}>
            <span className={styles.posterName}>{name}</span>
            {screen ? (
              <span className={styles.posterTitle}>{pickText(screen.title, locale)}</span>
            ) : null}
          </span>
        )}
      </LiveDevice>
    </aside>
  );
}
