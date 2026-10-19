import type { ReactNode } from "react";
import styles from "./Auth.module.css";

/**
 * The frame of every Darb sign-in and sign-up (admin and helpers): one centred column under a warm
 * light, as if from an open door. The approved raster mark (never redrawn), the app's name, a short
 * headline, optional "how it works" stops along a road, then the form.
 */
export function AuthStage({
  eyebrow,
  title,
  lead,
  stepsLabel,
  steps,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  stepsLabel?: string;
  steps?: { title: string; hint: string }[];
  children: ReactNode;
}) {
  return (
    <main id="main" className={styles.stage}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.column}>
        <header className={styles.hero}>
          <span className={styles.markWrap}>
            <span className={styles.halo} aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element -- the approved raster mark, never redrawn */}
            <img
              className={styles.mark}
              src="/brand/darb-mark-192.webp"
              alt=""
              width={66}
              height={77}
            />
          </span>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          {lead ? <p className={styles.lead}>{lead}</p> : null}
        </header>
        {steps?.length ? (
          <ol className={styles.steps} aria-label={stepsLabel}>
            {steps.map((s, i) => (
              <li key={i}>
                <span className={styles.stop} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={styles.stepText}>
                  <strong>{s.title}</strong>
                  <span>{s.hint}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : null}
        <section className={styles.card}>{children}</section>
      </div>
    </main>
  );
}

/** The local e2e form and the "not set up" note share the card's look. */
export const authStyles = styles;
