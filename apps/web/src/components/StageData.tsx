"use client";

import { useEffect } from "react";
import type { StageLevel } from "@darb/stage";
import { stageStore } from "@/lib/stage-store";

/** Publishes this page's level to the lazy stage. Renders nothing: the list is the page. */
export function StageData({ level }: { level: StageLevel }) {
  useEffect(() => {
    stageStore.set(level);
    return () => {
      if (stageStore.get() === level) stageStore.set(null);
    };
  }, [level]);
  return null;
}
