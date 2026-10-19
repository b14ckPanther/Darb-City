"use client";

import { useEffect, useState } from "react";
import { PROMPT_EVENT, PROMPT_KEY, iosSafari, standalone } from "@/lib/install";
import styles from "./helpers.module.css";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };
type Mode = "none" | "prompt" | "ios";

/** Where the card remembers "Not now" (per browser; it never comes back after that). */
export const HELPER_INSTALL_KEY = "darb-helper-install";

export interface InstallCardCopy {
  title: string;
  lead: string;
  button: string;
  ios: string;
  /** iOS, as two steps: Safari's Share button (drawn as it looks), then Add to Home Screen. */
  iosShare: string;
  iosAdd: string;
  dismiss: string;
}

const held = () => (window as unknown as Record<string, InstallPrompt | null>)[PROMPT_KEY] ?? null;

function dismissed(): boolean {
  try {
    return localStorage.getItem(HELPER_INSTALL_KEY) === "dismissed";
  } catch {
    return false;
  }
}

/**
 * Put the helper app on the home screen: on Android, a button for Chrome's own install prompt (the
 * layout's boot script holds it); on iOS Safari, which has none, the steps as text. Nothing once
 * the app runs from the home screen, or after "Not now".
 */
export function InstallCard({ copy }: { copy: InstallCardCopy }) {
  const [mode, setMode] = useState<Mode>("none");

  useEffect(() => {
    if (standalone() || dismissed()) return;
    const sync = () => setMode(held() ? "prompt" : iosSafari(navigator) ? "ios" : "none");
    sync();
    window.addEventListener(PROMPT_EVENT, sync);
    return () => window.removeEventListener(PROMPT_EVENT, sync);
  }, []);

  if (mode === "none") return null;
  const dismiss = () => {
    try {
      localStorage.setItem(HELPER_INSTALL_KEY, "dismissed");
    } catch {
      // Storage is blocked: it simply shows again next time.
    }
    setMode("none");
  };
  return (
    <section className={styles.install} aria-labelledby="helper-install" data-install-card={mode}>
      <h2 id="helper-install" className={styles.installTitle}>
        {copy.title}
      </h2>
      {mode === "ios" ? (
        <ol className={styles.installSteps} aria-label={copy.ios}>
          <li>
            <span>{copy.iosShare}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
              <path
                d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </li>
          <li>
            <span>{copy.iosAdd}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
              <path
                d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm7 4v8m-4-4h8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </li>
        </ol>
      ) : (
        <p className={styles.muted}>{copy.lead}</p>
      )}
      <div className={styles.row}>
        {mode === "prompt" ? (
          <button
            type="button"
            className={styles.primary}
            onClick={async () => {
              const prompt = held();
              if (!prompt) return;
              await prompt.prompt();
              await prompt.userChoice;
              // A prompt is good for one answer; Chrome offers a fresh one later if it still applies.
              (window as unknown as Record<string, null>)[PROMPT_KEY] = null;
              setMode("none");
            }}
          >
            {copy.button}
          </button>
        ) : null}
        <button type="button" className={styles.ghost} onClick={dismiss}>
          {copy.dismiss}
        </button>
      </div>
    </section>
  );
}
