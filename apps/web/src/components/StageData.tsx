"use client";

import { useEffect } from "react";
import type { StageLevel } from "@darb/stage";
import { stageStore } from "@/lib/stage-store";

/** How many mounted StageData publish each level (Strict Mode mounts twice). */
const holders = new Map<StageLevel, number>();

/**
 * Publishes this page's level to the lazy stage. Renders nothing: the list is the page. The clear on
 * unmount waits a microtask, so a page replaced in the same commit hands over straight to the next
 * level and the stage never sees null in between.
 */
export function StageData({ level }: { level: StageLevel }) {
  useEffect(() => {
    holders.set(level, (holders.get(level) ?? 0) + 1);
    stageStore.set(level);
    return () => {
      const left = (holders.get(level) ?? 1) - 1;
      if (left > 0) holders.set(level, left);
      else holders.delete(level);
      queueMicrotask(() => {
        if (!holders.has(level) && stageStore.get() === level) stageStore.set(null);
      });
    };
  }, [level]);
  return null;
}
