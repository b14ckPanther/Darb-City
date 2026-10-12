"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Looks up the closest real path once the 404 is on screen. `template` holds "{name}". */
export function ClosestMatch({ template }: { template: string }) {
  const [match, setMatch] = useState<{ href: string; label: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/closest?path=${encodeURIComponent(window.location.pathname)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ href: string; label: string }>) : null))
      .then((found) => setMatch(found))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  if (!match) return null;
  const [before, after] = template.split("{name}");
  return (
    <p className="lede">
      {before}
      <Link href={match.href} className="text-link" data-closest-match="">
        {match.label}
      </Link>
      {after}
    </p>
  );
}
