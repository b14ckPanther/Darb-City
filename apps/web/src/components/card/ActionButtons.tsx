"use client";

import { useState, type ReactNode } from "react";

/** Share, the one card button that runs code in the page (the rest are plain links). */

/**
 * Share: the device's share sheet, else the link copied. The word under the icon says what
 * happened ("Link copied"), and a status region says it to screen readers.
 */
export function ShareButton({
  url,
  title,
  className,
  bubble,
  labelClassName,
  labels,
}: {
  url: string;
  title: string;
  className: string | undefined;
  bubble: ReactNode;
  labelClassName: string | undefined;
  labels: { share: string; linkCopied: string; linkCopyFailed: string };
}) {
  const [status, setStatus] = useState("");

  async function onShare() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch {
        // Dismissed: nothing to say.
      }
      return;
    }
    try {
      if (!navigator.clipboard) throw new Error("No clipboard");
      await navigator.clipboard.writeText(url);
      setStatus(labels.linkCopied);
    } catch {
      setStatus(labels.linkCopyFailed);
    }
  }

  return (
    <>
      <button type="button" className={className} data-action="share" onClick={onShare}>
        {bubble}
        <span className={labelClassName}>{status || labels.share}</span>
      </button>
      <span role="status" className="visually-hidden" data-share-status="">
        {status}
      </span>
    </>
  );
}
