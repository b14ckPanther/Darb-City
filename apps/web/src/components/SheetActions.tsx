"use client";

import { useState } from "react";
import type { PrimaryAction } from "@/lib/links";
import styles from "./Experience.module.css";

export interface SheetActionsProps {
  primary: PrimaryAction;
  /** The business's own call to action, e.g. "Book a chair". */
  ctaLabel: string;
  /** Already-safe hrefs (tel:, https://wa.me, https://…) or null when absent. */
  secondary: {
    call: string | null;
    whatsapp: string | null;
    directions: string;
    website: string | null;
    apps: { label: string; href: string }[];
  };
  share: { url: string; title: string };
  labels: {
    call: string;
    whatsapp: string;
    directions: string;
    share: string;
    website: string;
    exampleNotice: string;
    linkCopied: string;
    linkCopyFailed: string;
  };
}

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

export function SheetActions({ primary, ctaLabel, secondary, share, labels }: SheetActionsProps) {
  const [status, setStatus] = useState("");

  async function onShare() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: share.title, url: share.url });
      } catch {
        // Dismissed: nothing to say.
      }
      return;
    }
    try {
      if (!navigator.clipboard) throw new Error("No clipboard");
      await navigator.clipboard.writeText(share.url);
      setStatus(labels.linkCopied);
    } catch {
      setStatus(labels.linkCopyFailed);
    }
  }

  return (
    <div className={styles.actions}>
      {primary.kind === "whatsapp" || primary.kind === "call" ? (
        <a
          href={primary.href}
          className={styles.primary}
          data-primary-action=""
          {...(primary.kind === "whatsapp" ? external : {})}
        >
          {ctaLabel}
        </a>
      ) : primary.kind === "example" ? (
        <button
          type="button"
          className={styles.primary}
          data-primary-action=""
          onClick={() => setStatus(labels.exampleNotice)}
        >
          {ctaLabel}
        </button>
      ) : null}
      <p role="status" className={styles.status} data-sheet-status="">
        {status}
      </p>
      <ul className={styles.secondary}>
        {secondary.call ? (
          <li>
            <a href={secondary.call}>{labels.call}</a>
          </li>
        ) : null}
        {secondary.whatsapp ? (
          <li>
            <a href={secondary.whatsapp} {...external}>
              {labels.whatsapp}
            </a>
          </li>
        ) : null}
        <li>
          <a href={secondary.directions} {...external}>
            {labels.directions}
          </a>
        </li>
        <li>
          <button type="button" onClick={onShare}>
            {labels.share}
          </button>
        </li>
        {secondary.website ? (
          <li>
            <a href={secondary.website} {...external}>
              {labels.website}
            </a>
          </li>
        ) : null}
        {secondary.apps.map((app) => (
          <li key={app.href}>
            <a href={app.href} {...external} data-open-app="">
              {app.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
