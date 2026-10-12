"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Locale } from "@darb/core";
import { stageAllowed } from "@/lib/stage-boot";
import type { StageLabels, StageProps } from "@/stage/types";
import styles from "./StageMount.module.css";

/** If the stage's chunk cannot load, the city stays a list. */
function StageUnavailable({ onFail }: StageProps) {
  useEffect(() => onFail(), [onFail]);
  return null;
}

/** The map and plaza live in an async chunk, fetched only when StageMount renders <Stage>. */
const Stage = dynamic<StageProps>(
  () =>
    import("@/stage/Stage").then(
      (m) => m.Stage,
      () => StageUnavailable,
    ),
  { ssr: false },
);

const noSubscription = () => () => {};
const isCapable = () => document.documentElement.hasAttribute("data-stage-capable");

/**
 * The Zoomable City's mount point (spec §6.3): waits until the list is interactive (page loaded,
 * browser idle), then loads the stage. Keeps html[data-stage] in step with the path.
 */
export function StageMount({ locale, labels }: { locale: Locale; labels: StageLabels }) {
  const pathname = usePathname();
  const capable = useSyncExternalStore(noSubscription, isCapable, () => false);
  const [failed, setFailed] = useState(false);
  const [wanted, setWanted] = useState(false);
  const allowed = capable && !failed && stageAllowed(pathname);
  const onFail = useCallback(() => setFailed(true), []);

  useEffect(() => {
    if (capable) document.documentElement.setAttribute("data-stage", allowed ? "on" : "off");
  }, [capable, allowed]);

  useEffect(() => {
    if (!allowed || wanted) return;
    let idle = 0;
    let timer = 0;
    const start = () => {
      if (typeof window.requestIdleCallback === "function")
        idle = window.requestIdleCallback(() => setWanted(true), { timeout: 2000 });
      else timer = window.setTimeout(() => setWanted(true), 300);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
    };
  }, [allowed, wanted]);

  return (
    <div id="stage" className={styles.stage} data-stage-root="">
      {allowed && wanted ? <Stage locale={locale} labels={labels} onFail={onFail} /> : null}
    </div>
  );
}
