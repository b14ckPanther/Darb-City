import type { CSSProperties } from "react";
import type { Locale, Template } from "@darb/core";
import type { ScreenDto } from "@darb/contracts";
import { contrastRatio, readableOn } from "@/lib/contrast";
import { TEMPLATE_BODIES } from "./index";
import { text } from "./shared";
import styles from "./templates.module.css";

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
  const { bg, ink } = screen.palette;
  // Seeded palettes pass AA; a bad one from the API still renders readable text.
  const safeInk = contrastRatio(ink, bg) < 4.5 ? readableOn(bg) : ink;
  const font = screen.font.replace(/[^\p{L}\p{N} -]/gu, "");
  const style = {
    "--t-bg": screen.palette.bg,
    "--t-surface": screen.palette.surface,
    "--t-ink": safeInk,
    "--t-accent": screen.palette.accent,
    "--t-on-accent": readableOn(screen.palette.accent),
    "--t-font": `"${font}"`,
  } as CSSProperties;
  return (
    <section
      className={styles.screen}
      style={style}
      data-template={template}
      aria-label={text(screen.brand, locale)}
    >
      <div className={styles.appBar}>
        <span className={styles.brand}>{text(screen.brand, locale)}</span>
      </div>
      {/* A station's forecourt sign says what the title would. */}
      {template === "station" ? null : (
        <div className={styles.hero}>
          <p className={styles.title}>{text(screen.title, locale)}</p>
          {screen.subtitle ? (
            <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p>
          ) : null}
        </div>
      )}
      <Body screen={screen} locale={locale} />
    </section>
  );
}
