import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { KindRowData } from "@/lib/categories";
import { KindPreviewList } from "./KindPreviewList";
import styles from "./Categories.module.css";

/** Points toward the reading direction's end; RTL turns it around in CSS. */
export function Chevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" fill="currentColor" />
    </svg>
  );
}

export interface KindRowsProps {
  /** Rows, already sorted (lib/categories.ts). */
  kinds: KindRowData[];
  href: (slug: string) => string;
  /** The sector accent every row's dot wears. */
  accent: string;
  /** The count formatted for the locale. */
  countText: (n: number) => string;
  /** "Businesses: 3" for screen readers. */
  countLabel: (n: number) => string;
  /**
   * The place whose map previews a row's businesses (levels 1 and 2), with the copy that needs.
   * Absent on the country page: its rows only link.
   */
  preview?: {
    place: string;
    /** "Garages in Haifa". */
    title: (name: string) => string;
    /** "Garages on the map", the map button's name. */
    onMap: (name: string) => string;
  };
  /** Rows carry data-door (e2e and the sector page's doors). */
  doors?: boolean;
  label?: string;
  /** A last, quieter row (e.g. "All 12 kinds" into the sector). */
  more?: ReactNode;
  /** Rows on their own card (a sector page); inside a SectorGroup the group is the card. */
  card?: boolean;
}

/**
 * Categories as rows: one kind per row, all one height, an accent dot, the name, the count at the
 * end and a chevron. Where a place's map is beside the list, a row also previews its businesses on
 * the map (hover or focus; a phone's map button), and the row being previewed stays marked.
 */
export function KindRows({
  kinds,
  href,
  accent,
  countText,
  countLabel,
  preview,
  doors,
  label,
  more,
  card,
}: KindRowsProps) {
  const rows = kinds.map((k) => (
    <li
      key={k.slug}
      className={styles.item}
      data-kind-row={k.slug}
      data-title={preview?.title(k.name)}
      data-count={k.count}
    >
      <Link
        href={href(k.slug)}
        className={styles.row}
        data-door={doors ? k.slug : undefined}
        data-count={doors ? k.count : undefined}
      >
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.name}>{k.name}</span>
        <span className={styles.count} aria-hidden="true">
          {countText(k.count)}
        </span>
        <span className="visually-hidden">{countLabel(k.count)}</span>
        <Chevron className={styles.chevron} />
      </Link>
      {preview ? (
        <button
          type="button"
          className={styles.onMap}
          aria-label={preview.onMap(k.name)}
          aria-pressed="false"
          data-kind-preview={k.slug}
        >
          <PinGlyph />
        </button>
      ) : null}
    </li>
  ));
  const style = { "--row-accent": accent } as CSSProperties;
  const moreRow = more ? <li className={styles.moreItem}>{more}</li> : null;
  const className = card ? `${styles.rows} ${styles.card}` : styles.rows;
  return preview ? (
    <KindPreviewList place={preview.place} className={className} style={style} label={label}>
      {rows}
      {moreRow}
    </KindPreviewList>
  ) : (
    <ul className={className} style={style} aria-label={label}>
      {rows}
      {moreRow}
    </ul>
  );
}

export interface SectorGroupProps {
  slug: string;
  name: string;
  tagline: string;
  accent: string;
  /** The sector page; the header is its door (data-door). */
  href: string;
  totalText: string;
  totalLabel: string;
  total: number;
  children: ReactNode;
}

/** A sector: its header (name, short line, total) over its kind rows, on one calm card. */
export function SectorGroup({
  slug,
  name,
  tagline,
  accent,
  href,
  totalText,
  totalLabel,
  total,
  children,
}: SectorGroupProps) {
  return (
    <section
      className={styles.group}
      style={{ "--row-accent": accent } as CSSProperties}
      aria-labelledby={`sector-${slug}`}
      data-sector-group={slug}
    >
      <h2 id={`sector-${slug}`} className={styles.heading}>
        <Link href={href} className={styles.head} data-door={slug} data-count={total}>
          <span className={styles.headDot} aria-hidden="true" />
          <span className={styles.headText}>
            <span className={styles.headName}>{name}</span>
            {tagline ? <span className={styles.tagline}>{tagline}</span> : null}
          </span>
          <span className={styles.total} aria-hidden="true">
            {totalText}
          </span>
          <span className="visually-hidden">{totalLabel}</span>
          <Chevron className={styles.chevron} />
        </Link>
      </h2>
      {children}
    </section>
  );
}
