import type { StageLevel } from "@darb/stage";

/**
 * The level the page shows, for the lazy stage. Level pages publish it through <StageData>; the
 * stage reads it with useSyncExternalStore. Null: the page is not a city level.
 */
let current: StageLevel | null = null;
const listeners = new Set<() => void>();

export const stageStore = {
  get: (): StageLevel | null => current,
  set(level: StageLevel | null): void {
    if (level === current) return;
    current = level;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
