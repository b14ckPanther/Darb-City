import type { CSSProperties, ReactNode } from "react";
import { itemKeys, Tags, text, type TemplateProps } from "./shared";
import styles from "./Station.module.css";

/**
 * A fuel station's screen, read like the forecourt: the grades it pumps as big pump numbers, each
 * with its nozzle colour, then what else is there as an icon grid. Items are matched by their
 * English label (the seed and the admin write "Fuel", "Car wash", ...); anything unknown still
 * shows, with a plain dot.
 */

type Service = "fuel" | "store" | "wash" | "air" | "ev" | "self" | "toilets" | "access" | "open";

const SERVICES: [Service, RegExp][] = [
  ["fuel", /\b(fuel|petrol|gasoline)\b/i],
  ["store", /\b(yellow|store|shop|convenience)\b/i],
  ["wash", /\bwash\b/i],
  ["air", /\b(air|tyre|tire)\b/i],
  ["ev", /\b(ev|electric|charg)/i],
  ["self", /\bself\b/i],
  ["toilets", /(toilet|restroom|\bwc\b)/i],
  ["access", /\b(wheelchair|accessib)/i],
  ["open", /24\s*\/\s*7|24 hours/i],
];

const serviceOf = (en: string): Service | null =>
  SERVICES.find(([, re]) => re.test(en))?.[0] ?? null;

/** Israeli forecourts colour each grade's nozzle; the tile carries the same colour. */
const GRADE_TONE: Record<string, string> = {
  "95": "#2f9e57",
  "96": "#2f9e57",
  "98": "#2f6fd6",
  diesel: "#c9ccd1",
};
const toneOf = (en: string) => GRADE_TONE[en.trim().toLowerCase()] ?? "#d9a54c";

const ICONS: Record<Service | "dot", ReactNode> = {
  fuel: (
    <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M4 21h12M8 8h4M15 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V9l-3-3" />
  ),
  store: <path d="M4 9h16l-1 11H5L4 9Zm4 0V7a4 4 0 0 1 8 0v2" />,
  wash: (
    <path d="M4 15l2-5h12l2 5v4H4v-4Zm3 4v2m10-2v2M7 15h.01M17 15h.01M8 6c0-1.5 1-2.5 1-2.5S10 4.5 10 6a1 1 0 0 1-2 0Zm6 0c0-1.5 1-2.5 1-2.5s1 1 1 2.5a1 1 0 0 1-2 0Z" />
  ),
  air: <path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7" />,
  ev: <path d="M13 3 6 13h5l-1 8 7-10h-5l1-8Z" />,
  self: (
    <path d="M9 11V5a1.5 1.5 0 0 1 3 0v5m0-1a1.5 1.5 0 0 1 3 0v2m0-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.6-1.5L9 14" />
  ),
  toilets: (
    <path d="M7 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM5 21v-6H4l1-7h4l1 7H9v6M15 21v-5h-2l2-8h4l2 8h-2v5M12 3v18" />
  ),
  access: (
    <path d="M11 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10 7v7h6l3 6M10 10h5M7 11a5 5 0 1 0 7 7" />
  ),
  open: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2" />,
  dot: <circle cx="12" cy="12" r="3" />,
};

function Glyph({ name }: { name: Service | "dot" }) {
  return (
    <svg
      className={styles.glyph}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

export function Station({ screen, locale }: TemplateProps) {
  const items = screen.items.map((item) => ({
    item,
    kind: serviceOf(item.label.en ?? ""),
  }));
  const fuel = items.find((i) => i.kind === "fuel");
  // "95 · 98 · Diesel": one tile per grade, its name in the visitor's language.
  const grades = fuel?.item.meta
    ? (fuel.item.meta.en ?? "").split("·").map((en, i) => ({
        en: en.trim(),
        label: text(fuel.item.meta, locale).split("·")[i]?.trim() ?? en.trim(),
      }))
    : [];
  const open = items.find((i) => i.kind === "open");
  const rest = items.filter((i) => i.kind !== "fuel" && i.kind !== "open");
  return (
    <div className={styles.station}>
      <div
        className={styles.forecourt}
        {...(fuel ? { "data-item": "", "data-match-keys": itemKeys(fuel.item) } : {})}
      >
        <span className={styles.pumpIcon}>
          <Glyph name="fuel" />
        </span>
        <p className={styles.fuelLabel}>
          {fuel ? text(fuel.item.label, locale) : text(screen.title, locale)}
        </p>
        {open ? (
          <p className={styles.always} data-item="" data-match-keys={itemKeys(open.item)}>
            {text(open.item.label, locale)}
          </p>
        ) : null}
      </div>
      {grades.length > 0 ? (
        <ul className={styles.grades}>
          {grades.map((g) => (
            <li key={g.en} style={{ "--tone": toneOf(g.en) } as CSSProperties}>
              <span className={styles.nozzle} aria-hidden="true" />
              <span className={/^\d+$/.test(g.en) ? styles.octane : styles.gradeWord}>
                {g.label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {rest.length > 0 ? (
        <ul className={styles.services}>
          {rest.map(({ item, kind }, i) => (
            <li key={i} data-item="" data-match-keys={itemKeys(item)}>
              <span className={styles.badge}>
                <Glyph name={kind ?? "dot"} />
              </span>
              <span className={styles.serviceName}>{text(item.label, locale)}</span>
              {item.meta ? (
                <span className={styles.serviceMeta}>{text(item.meta, locale)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
