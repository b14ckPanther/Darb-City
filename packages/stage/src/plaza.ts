import type { StageDoor } from "./types.js";

/** Layout constants in CSS px. `label` is the room under each door for two lines of its name. */
export const PLAZA = {
  margin: 16,
  /** Room above the gate for the plaza caption. */
  top: 56,
  gap: 12,
  label: 40,
  minTarget: 44,
  maxDoor: 96,
  /** Preferred slot width: 4 doors a row on a phone, up to 6 on desktop. */
  slot: 88,
  rowShrink: 0.08,
  minRowScale: 0.6,
  gateMin: 64,
  gateMax: 128,
} as const;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlazaViewport {
  width: number;
  height: number;
  dir: "ltr" | "rtl";
}

export interface PlazaDoor extends StageDoor {
  index: number;
  row: number;
  lit: boolean;
  /** The drawn doorway, 2:3 like DOOR_PATH's 100 × 150 box. */
  frame: Box;
  /** The link: the doorway and its label beneath, never under 44 × 44 px. */
  hit: Box;
}

export interface PlazaRow {
  index: number;
  scale: number;
  /** 1 for the front row (moves most), down to 0.4 for the back row. */
  parallax: number;
  doors: number[];
}

export interface PlazaStreet {
  door: number;
  from: [number, number];
  to: [number, number];
  width: number;
  color: string;
}

export interface PlazaScene {
  width: number;
  /** At least the viewport height; taller when the doors need it (the plaza then scrolls). */
  height: number;
  dir: "ltr" | "rtl";
  gate: Box;
  streets: PlazaStreet[];
  rows: PlazaRow[];
  doors: PlazaDoor[];
}

const rowScale = (row: number) => Math.max(PLAZA.minRowScale, 1 - PLAZA.rowShrink * row);

/** Doors per row: as many as fit, but never so many that the back row drops under 44 px. */
function rowLayout(count: number, inner: number): { perRow: number; rows: number } {
  let perRow = Math.min(6, Math.max(3, Math.floor(inner / PLAZA.slot)));
  for (;;) {
    const rows = Math.max(1, Math.ceil(count / perRow));
    const backSlot = (inner * rowScale(rows - 1)) / perRow;
    if (perRow === 1 || backSlot - PLAZA.gap >= PLAZA.minTarget) return { perRow, rows };
    perRow -= 1;
  }
}

/**
 * The 2.5D plaza: the Darb gate at the head, doors in rows that recede toward it (the first doors
 * nearest, in front), and a lit street from the gate to every door. Pure: same input, same scene.
 */
export function buildPlaza(doors: readonly StageDoor[], viewport: PlazaViewport): PlazaScene {
  const { margin, gap, label, minTarget } = PLAZA;
  const width = Math.max(viewport.width, 2 * margin + minTarget + gap);
  const inner = width - 2 * margin;
  const { perRow, rows: rowCount } = rowLayout(doors.length, inner);
  const sizes = Array.from({ length: rowCount }, (_, r) => {
    const scale = rowScale(r);
    const slot = (inner * scale) / perRow;
    const w = Math.max(minTarget, Math.min(PLAZA.maxDoor * scale, slot - gap));
    return { scale, slot, w, h: w * 1.5 };
  });
  const rowsHeight =
    doors.length === 0 ? 0 : sizes.reduce((sum, s) => sum + s.h + label, 0) + gap * (rowCount - 1);
  const gateW = Math.min(PLAZA.gateMax, Math.max(PLAZA.gateMin, width * 0.14));
  const gateH = gateW * 1.5;
  const height = Math.max(viewport.height, PLAZA.top + gateH + 2 * gap + rowsHeight + margin);
  const mirror = (box: Box): Box =>
    viewport.dir === "rtl" ? { ...box, x: width - box.x - box.w } : box;

  const rows: PlazaRow[] = [];
  const placed: PlazaDoor[] = [];
  let bottom = height - margin;
  if (doors.length > 0)
    for (let r = 0; r < rowCount; r++) {
      const { scale, slot, w, h } = sizes[r]!;
      const members = doors.slice(r * perRow, (r + 1) * perRow);
      const top = bottom - h - label;
      const rowWidth = inner * scale;
      const start = margin + (inner - rowWidth) / 2 + (rowWidth - members.length * slot) / 2;
      const indexes: number[] = [];
      members.forEach((door, i) => {
        const index = r * perRow + i;
        const left = start + i * slot;
        indexes.push(index);
        placed.push({
          ...door,
          index,
          row: r,
          lit: door.count > 0,
          frame: mirror({ x: left + (slot - w) / 2, y: top, w, h }),
          hit: mirror({ x: left + gap / 2, y: top, w: slot - gap, h: h + label }),
        });
      });
      rows.push({
        index: r,
        scale,
        parallax: rowCount === 1 ? 1 : 1 - (0.6 * r) / (rowCount - 1),
        doors: indexes,
      });
      bottom = top - gap;
    }

  const gateBottom = doors.length === 0 ? height - margin : bottom + gap - 2 * gap;
  const gate: Box = { x: (width - gateW) / 2, y: gateBottom - gateH, w: gateW, h: gateH };
  const from: [number, number] = [width / 2, gate.y + gate.h];
  const streets: PlazaStreet[] = placed.map((d) => ({
    door: d.index,
    from,
    to: [d.frame.x + d.frame.w / 2, d.frame.y + d.frame.h],
    width: 2 + 4 * rows[d.row]!.scale,
    color: d.accent,
  }));
  return { width, height, dir: viewport.dir, gate, streets, rows, doors: placed };
}
