"use client";

import { useState, type ReactNode } from "react";
import styles from "./AppPreview.module.css";

/**
 * The phone's screen: the app's screenshot until asked, then the live app itself, laid out at a
 * phone's width (390px) and scaled into the frame. Nothing loads from the app before the tap.
 */
export function LiveDevice({
  url,
  title,
  live,
  children,
}: {
  url: string;
  title: string;
  live: string;
  children: ReactNode;
}) {
  const [on, setOn] = useState(false);
  return (
    <div className={styles.device} data-live={on ? "" : undefined}>
      <span className={styles.island} aria-hidden="true" />
      <div className={styles.glass}>
        {on ? (
          <iframe className={styles.frame} src={url} title={title} loading="lazy" />
        ) : (
          <>
            {children}
            <button type="button" className={styles.live} onClick={() => setOn(true)}>
              <span className={styles.liveDot} aria-hidden="true" />
              {live}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
