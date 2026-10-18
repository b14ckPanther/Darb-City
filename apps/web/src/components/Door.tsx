import { colors, DOOR_CLIP_PATH } from "@darb/tokens";
import styles from "./Door.module.css";

/**
 * Hidden SVG definitions: `clip-path: url(#darb-door-clip)` and the gold rim gradient the plaza
 * scenery strokes with. Render once. (Categories are rows now: Categories.tsx.)
 */
export function DoorDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className={styles.defs}>
      <defs>
        <clipPath id="darb-door-clip" clipPathUnits="objectBoundingBox">
          <path d={DOOR_CLIP_PATH} />
        </clipPath>
        <linearGradient id="darb-gold-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colors.gold100} />
          <stop offset="0.45" stopColor={colors.gold} />
          <stop offset="1" stopColor={colors.gold900} />
        </linearGradient>
      </defs>
    </svg>
  );
}
