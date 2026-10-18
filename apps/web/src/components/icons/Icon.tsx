import { useId } from "react";
import type { CardIconStyle } from "@darb/core";
import styles from "./Icon.module.css";

/**
 * Darb's card icons on one 24 px grid, in two styles from one drawing: "line" strokes the outline,
 * "solid" fills it and cuts the inner strokes out of the fill. Generic glyphs are drawn for Darb;
 * the brands (WhatsApp, Waze, Instagram, Facebook, TikTok) are simple recognisable marks in
 * currentColor, not the companies' artwork. Icons that point a way mirror in right-to-left pages;
 * brand marks never do.
 */
export type IconName =
  | "phone"
  | "whatsapp"
  | "waze"
  | "maps"
  | "globe"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "share"
  | "clock"
  | "pin"
  | "calendar"
  | "app"
  | "leaf"
  | "chevron"
  | "close"
  | "star";

interface Drawing {
  /** The outline: stroked in line, filled in solid. */
  shape?: string;
  /** Inner strokes: drawn in line, cut out of the fill in solid. */
  cuts?: string[];
  /** Inner dots: filled in line, cut out in solid. */
  dots?: string[];
  /** Strokes that stay strokes in both styles (outside the shape, or a plain glyph). */
  lines?: string[];
  /** Filled in both styles. */
  marks?: string[];
  /** Points a way: flipped in right-to-left pages. */
  mirror?: boolean;
}

/** A circle as a path, so every part of a drawing is one `d`. */
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

const DRAWINGS: Record<IconName, Drawing> = {
  phone: {
    shape:
      "M6.6 3.5h2.6l1.3 3.6-1.8 1.4a12 12 0 0 0 6.8 6.8l1.4-1.8 3.6 1.3v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z",
  },
  whatsapp: {
    shape: "M4 20l1.2-3.8A8.5 8.5 0 1 1 8 19Z",
    dots: [
      "M9.3 8.2c.3 2.2 2.4 4.6 4.6 5.2l1.1-1.1 1.8.8-.3 1.4c-3.2.3-7.3-3.7-7.3-7.1l1.4-.3.8 1.8Z",
    ],
  },
  waze: {
    shape:
      "M6.3 17.4C4.2 17 3 15.8 3 14.4c1 0 1.6-.7 1.6-2.2C4.6 7.6 8.1 4 12.4 4c4.5 0 8.1 3.4 8.1 7.7 0 3-1.8 5.1-4.4 6.2Z",
    cuts: ["M10 13.2c1.2 1.1 3.5 1.1 4.7 0"],
    dots: [circle(10.2, 10.2, 1), circle(15, 10.2, 1)],
    marks: [circle(8, 19.2, 1.8), circle(15.4, 19.2, 1.8)],
  },
  maps: {
    shape: "M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5Z",
    cuts: ["M9 4v13.5", "M15 6.5V20"],
  },
  globe: {
    shape: circle(12, 12, 9),
    cuts: [
      "M3 12h18",
      "M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
    ],
  },
  instagram: {
    shape: "M8.5 3.5h7a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5v-7a5 5 0 0 1 5-5Z",
    cuts: [circle(12, 12, 4)],
    dots: [circle(17.1, 6.9, 1)],
  },
  facebook: {
    shape: circle(12, 12, 9),
    cuts: ["M13.4 21v-9.4c0-1.7.8-2.6 2.5-2.6h1.3", "M9.8 13.4h6"],
  },
  tiktok: {
    shape:
      "M14.5 3c.4 2.6 2 4.2 4.5 4.4v3a7.6 7.6 0 0 1-4.4-1.4v6.3A5.6 5.6 0 1 1 9 9.7v3.1a2.6 2.6 0 1 0 2.5 2.6V3Z",
  },
  share: {
    lines: ["M8.3 10.8 15.7 6.7", "M8.3 13.2l7.4 4.1"],
    marks: [circle(6, 12, 2.6), circle(18, 5.5, 2.6), circle(18, 18.5, 2.6)],
  },
  clock: {
    shape: circle(12, 12, 9),
    cuts: ["M12 7v5l3 2"],
  },
  pin: {
    shape: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z",
    cuts: [circle(12, 10, 2.3)],
  },
  calendar: {
    shape:
      "M5.5 5h13A2.5 2.5 0 0 1 21 7.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-11A2.5 2.5 0 0 1 5.5 5Z",
    cuts: ["M3 10h18"],
    dots: [circle(8, 14.5, 1.1), circle(12, 14.5, 1.1), circle(16, 14.5, 1.1)],
    lines: ["M8 3v4", "M16 3v4"],
  },
  app: {
    shape:
      "M9.5 2.5h5A2.5 2.5 0 0 1 17 5v14a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 19V5a2.5 2.5 0 0 1 2.5-2.5Z",
    cuts: ["M10.8 18.3h2.4"],
  },
  leaf: {
    shape: "M5 19C5 10.5 10 5 19.5 4.5 19.5 14 14 19 5 19Z",
    cuts: ["M5 19 14 10"],
  },
  chevron: { lines: ["M9 5l7 7-7 7"], mirror: true },
  close: { lines: ["M6 6l12 12", "M18 6 6 18"] },
  star: {
    shape: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z",
  },
};

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function Icon({
  name,
  variant = "line",
  size = 24,
  className,
}: {
  name: IconName;
  variant?: CardIconStyle;
  size?: number;
  className?: string;
}) {
  const id = useId();
  const d = DRAWINGS[name];
  const solid = variant === "solid" && d.shape !== undefined;
  const cut = `icon-cut${id.replace(/[^\w-]/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      className={
        [d.mirror ? styles.mirror : null, className].filter(Boolean).join(" ") || undefined
      }
    >
      {solid ? (
        <>
          <mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="#fff" />
            {d.cuts?.map((c) => (
              <path key={c} d={c} {...STROKE} stroke="#000" />
            ))}
            {d.dots?.map((c) => (
              <path key={c} d={c} fill="#000" />
            ))}
          </mask>
          <path d={d.shape} {...STROKE} fill="currentColor" mask={`url(#${cut})`} />
        </>
      ) : (
        <>
          {d.shape ? <path d={d.shape} {...STROKE} /> : null}
          {d.cuts?.map((c) => (
            <path key={c} d={c} {...STROKE} />
          ))}
          {d.dots?.map((c) => (
            <path key={c} d={c} fill="currentColor" />
          ))}
        </>
      )}
      {d.lines?.map((c) => (
        <path key={c} d={c} {...STROKE} />
      ))}
      {d.marks?.map((c) =>
        // Share's nodes read as rings in line and as dots in solid.
        variant === "solid" || name !== "share" ? (
          <path key={c} d={c} fill="currentColor" />
        ) : (
          <path key={c} d={c} {...STROKE} />
        ),
      )}
    </svg>
  );
}
