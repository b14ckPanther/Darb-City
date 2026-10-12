import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { colors, DOOR_CLIP_PATH, DOOR_PATH } from "@darb/tokens";
import styles from "./Door.module.css";

/** Hidden SVG definitions: `clip-path: url(#darb-door-clip)` and the gold rim gradient. Render once. */
export function DoorDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className={styles.defs}>
      <defs>
        <clipPath id="darb-door-clip" clipPathUnits="objectBoundingBox">
          <path d={DOOR_CLIP_PATH} />
        </clipPath>
        <linearGradient id="darb-gold-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colors.gold100} />
          <stop offset="0.45" stopColor={colors.gold} />
          <stop offset="1" stopColor={colors.gold900} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** A thin gold rim tracing the doorway, scaled to its box. */
export function DoorRim({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 150"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={DOOR_PATH}
        fill="none"
        stroke="url(#darb-gold-stroke)"
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function DoorGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className={styles.grid} aria-label={label}>
      {children}
    </ul>
  );
}

export interface DoorProps {
  slug: string;
  href: string;
  label: string;
  sublabel?: string;
  count: number;
  /** The count formatted for the locale. */
  countText: string;
  /** "Businesses: 3" for screen readers. */
  countLabel: string;
  /** A sector accent (warm, desaturated hex). */
  accent?: string;
}

export function Door({
  slug,
  href,
  label,
  sublabel,
  count,
  countText,
  countLabel,
  accent,
}: DoorProps) {
  const style = accent ? ({ "--door-accent": accent } as CSSProperties) : undefined;
  return (
    <li>
      <Link
        href={href}
        className={styles.door}
        style={style}
        data-door={slug}
        data-count={count}
        data-empty={count === 0 ? "" : undefined}
      >
        <span className={styles.frame} aria-hidden="true">
          <span className={styles.glow} />
          <DoorRim className={styles.rim} />
          <span className={styles.countInFrame}>{countText}</span>
        </span>
        <span className={styles.text}>
          <span className={styles.label}>{label}</span>
          {sublabel ? <span className={styles.sublabel}>{sublabel}</span> : null}
        </span>
        <span className={styles.countInline} aria-hidden="true">
          {countText}
        </span>
        <span className="visually-hidden">{countLabel}</span>
      </Link>
    </li>
  );
}
