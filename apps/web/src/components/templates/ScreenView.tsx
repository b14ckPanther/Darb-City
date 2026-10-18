import type { CSSProperties } from "react";
import type { Locale, Template } from "@darb/core";
import type { ScreenDto } from "@darb/contracts";
import { contrastRatio, readableAccent, readableOn } from "@/lib/contrast";
import { TEMPLATE_BODIES } from "./index";
import { MatchHighlight } from "./MatchHighlight";
import { text } from "./shared";
import styles from "./templates.module.css";

/**
 * Darb's own night palette, which every imported business starts with. A screen in it follows the
 * site's theme (paper by day, forest by night); a business's own palette is its brand and stays.
 */
const DARB_NIGHT = { bg: "#0e1b15", surface: "#172a21", ink: "#f6efe0" };
const DARB_DAY = { bg: "#fffdf8", surface: "#f5eddc", ink: "#14281f" };

export const isDarbPalette = (p: ScreenDto["palette"]) =>
  p.bg.toLowerCase() === DARB_NIGHT.bg &&
  p.surface.toLowerCase() === DARB_NIGHT.surface &&
  p.ink.toLowerCase() === DARB_NIGHT.ink;

/** The first letter of the brand, for its monogram. */
const initial = (brand: string) => [...brand.trim()][0] ?? "";

/** The business's own app screen, in its own palette and typeface. */
export function ScreenView({
  screen,
  template,
  locale,
}: {
  screen: ScreenDto;
  template: Template;
  locale: Locale;
}) {
  const Body = TEMPLATE_BODIES[template];
  const { bg, surface, ink, accent } = screen.palette;
  // Seeded palettes pass AA; a bad one from the API still renders readable text.
  const safeInk = contrastRatio(ink, bg) < 4.5 ? readableOn(bg) : ink;
  const font = screen.font.replace(/[^\p{L}\p{N} -]/gu, "");
  const darb = isDarbPalette(screen.palette);
  const shared = {
    "--t-accent": accent,
    "--t-on-accent": readableOn(accent),
    "--t-font": `"${font}"`,
  };
  // A Darb palette screen carries both themes' colours; CSS picks one (templates.module.css).
  const vars: Record<string, string> = darb
    ? {
        ...shared,
        "--night-bg": bg,
        "--night-surface": surface,
        "--night-ink": safeInk,
        "--night-accent-ink": readableAccent(accent, surface, safeInk),
        "--day-bg": DARB_DAY.bg,
        "--day-surface": DARB_DAY.surface,
        "--day-ink": DARB_DAY.ink,
        "--day-accent-ink": readableAccent(accent, DARB_DAY.surface, DARB_DAY.ink),
      }
    : {
        ...shared,
        "--t-bg": bg,
        "--t-surface": surface,
        "--t-ink": safeInk,
        "--t-accent-ink": readableAccent(accent, surface, safeInk),
      };
  const style = vars as CSSProperties;
  const brand = text(screen.brand, locale);
  return (
    <section
      className={styles.screen}
      style={style}
      data-template={template}
      data-palette={darb ? "darb" : "own"}
      aria-label={brand}
    >
      <div className={styles.appBar}>
        <span className={styles.monogram} aria-hidden="true">
          {initial(brand)}
        </span>
        <span className={styles.brand}>{brand}</span>
      </div>
      <Body screen={screen} locale={locale} />
      <MatchHighlight />
    </section>
  );
}
