import type { ReactNode } from "react";
import type { CardAction } from "@/lib/card";
import type { PrimaryAction } from "@/lib/links";
import { ShareButton } from "./card/ActionButtons";
import styles from "./card/Actions.module.css";

export interface SheetActionsProps {
  primary: PrimaryAction;
  /** The business's own call to action, e.g. "Book a chair". */
  ctaLabel: string;
  /** Already-safe links (tel:, https://wa.me, https://…), each once. */
  actions: CardAction[];
  share: { url: string; title: string } | null;
  /** The icons, drawn by the caller: one for the main button, one per action in order, Share's. */
  glyphs: { primary: ReactNode; actions: ReactNode[]; share: ReactNode };
  labels: {
    share: string;
    contactWays: string;
    exampleNotice: string;
    linkCopied: string;
    linkCopyFailed: string;
  };
  /** The /join preview: pictures of the buttons (nothing there leaves the form). */
  preview?: boolean;
}

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * The main button, then a row of round icon buttons, each with its short word under it. Plain
 * links, drawn on the server; only Share runs code in the page.
 */
export function SheetActions({
  primary,
  ctaLabel,
  actions,
  share,
  glyphs,
  labels,
  preview = false,
}: SheetActionsProps) {
  const bubble = (glyph: ReactNode) => <span className={styles.bubble}>{glyph}</span>;
  const face = (glyph: ReactNode, label: string) => (
    <>
      {bubble(glyph)}
      <span className={styles.actionLabel}>{label}</span>
    </>
  );
  const main = (
    <>
      {glyphs.primary}
      <span>{ctaLabel}</span>
    </>
  );

  return (
    <div className={styles.actions}>
      {primary.kind === "none" ? null : preview ? (
        <span className={styles.primary} data-primary-action="">
          {main}
        </span>
      ) : primary.kind === "example" ? (
        // A showroom example explains itself instead of contacting anyone (a disclosure: no JS).
        <details className={styles.example}>
          <summary className={styles.primary} data-primary-action="">
            {main}
          </summary>
          <p className={styles.status} data-sheet-status="">
            {labels.exampleNotice}
          </p>
        </details>
      ) : (
        <a
          href={primary.href}
          className={styles.primary}
          data-primary-action=""
          {...(primary.kind === "call" ? {} : external)}
        >
          {main}
        </a>
      )}
      <ul className={styles.row} aria-label={labels.contactWays}>
        {actions.map((a, i) => (
          <li key={a.href}>
            {preview ? (
              <span className={styles.action} data-action={a.key}>
                {face(glyphs.actions[i], a.label)}
              </span>
            ) : (
              <a
                href={a.href}
                className={styles.action}
                data-action={a.key}
                {...(a.key === "app" ? { "data-open-app": "" } : {})}
                {...(a.key === "call" ? {} : external)}
              >
                {face(glyphs.actions[i], a.label)}
              </a>
            )}
          </li>
        ))}
        {share ? (
          <li>
            {preview ? (
              <span className={styles.action} data-action="share">
                {face(glyphs.share, labels.share)}
              </span>
            ) : (
              <ShareButton
                url={share.url}
                title={share.title}
                className={styles.action}
                bubble={bubble(glyphs.share)}
                labelClassName={styles.actionLabel}
                labels={labels}
              />
            )}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
