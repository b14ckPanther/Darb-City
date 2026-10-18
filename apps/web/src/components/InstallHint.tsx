"use client";

import { useEffect, useState } from "react";
import { IOS_TIP_KEY, PROMPT_EVENT, PROMPT_KEY, iosSafari, standalone } from "@/lib/install";
import styles from "./InstallHint.module.css";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };
type Mode = "none" | "prompt" | "ios";

export interface InstallCopy {
  chip: string;
  iosTitle: string;
  iosBody: string;
  dismiss: string;
}

const held = () => (window as unknown as Record<string, InstallPrompt | null>)[PROMPT_KEY] ?? null;

function iosTipDismissed(): boolean {
  try {
    return localStorage.getItem(IOS_TIP_KEY) === "dismissed";
  } catch {
    return false;
  }
}

/**
 * A quiet way to put Darb on the home screen, inside the menu only (never a popup): on Chrome, a
 * chip that opens the browser's own install prompt; on iOS Safari, which has no prompt, a short tip
 * shown until it is dismissed once. Nothing at all once Darb runs from the home screen.
 */
export function InstallHint({ copy }: { copy: InstallCopy }) {
  const [mode, setMode] = useState<Mode>("none");

  useEffect(() => {
    if (standalone()) return;
    const sync = () => {
      if (held()) setMode("prompt");
      else if (iosSafari(navigator) && !iosTipDismissed()) setMode("ios");
      else setMode("none");
    };
    sync();
    window.addEventListener(PROMPT_EVENT, sync);
    return () => window.removeEventListener(PROMPT_EVENT, sync);
  }, []);

  if (mode === "prompt")
    return (
      <button
        type="button"
        className={styles.chip}
        data-install=""
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
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
          <path d="M12 8v6M9 11h6" />
        </svg>
        {copy.chip}
      </button>
    );

  if (mode === "ios")
    return (
      <div className={styles.tip} data-install-tip="" role="note">
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
          <path d="M12 3v11M8 7l4-4 4 4" />
          <path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v7A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16" />
        </svg>
        <p className={styles.text}>
          <strong>{copy.iosTitle}</strong>
          <span>{copy.iosBody}</span>
        </p>
        <button
          type="button"
          className={styles.dismiss}
          onClick={() => {
            try {
              localStorage.setItem(IOS_TIP_KEY, "dismissed");
            } catch {
              // Blocked storage: it hides for this page only.
            }
            setMode("none");
          }}
        >
          {copy.dismiss}
        </button>
      </div>
    );

  return null;
}
