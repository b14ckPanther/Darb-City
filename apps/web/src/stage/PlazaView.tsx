"use client";

import Link from "next/link";
import { useRef, type CSSProperties, type PointerEvent } from "react";
import { DOOR_PATH } from "@darb/tokens";
import { distance, isPinchOut, type Box, type PlazaScene } from "@darb/stage";
import styles from "./plaza.module.css";

export interface PlazaViewProps {
  scene: PlazaScene;
  /** Shown above the gate: the place (and sector). */
  caption: string;
  /** The navigation's accessible name. */
  label: string;
  countText: (count: number) => string;
  /** "Businesses: 3", for screen readers. */
  countLabel: (count: number) => string;
  /** Follow a fine pointer (desktop, motion allowed). */
  parallax: boolean;
  onPinchOut: () => void;
}

/** DOOR_PATH is drawn in a 100 × 150 box. */
const doorTransform = (b: Box) => `translate(${b.x} ${b.y}) scale(${b.w / 100} ${b.h / 150})`;
const vars = (values: Record<string, string | number>) => values as CSSProperties;

/**
 * The 2.5D plaza (spec §3.1): SVG scenery under real links. The links carry the list doors' hrefs,
 * in the list's order, and follow the list in the DOM, so Tab reaches the list first.
 */
export function PlazaView({
  scene,
  caption,
  label,
  countText,
  countLabel,
  parallax,
  onPinchOut,
}: PlazaViewProps) {
  const root = useRef<HTMLElement>(null);
  const touches = useRef(new Map<number, [number, number]>());
  const pinchStart = useRef<number | null>(null);

  const pair = (): number | null => {
    const points = [...touches.current.values()];
    return points.length === 2 ? distance(points[0]!, points[1]!) : null;
  };

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch") return;
    touches.current.set(event.pointerId, [event.clientX, event.clientY]);
    pinchStart.current = pair();
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") {
      if (!touches.current.has(event.pointerId)) return;
      touches.current.set(event.pointerId, [event.clientX, event.clientY]);
      const now = pair();
      if (pinchStart.current !== null && now !== null && isPinchOut(pinchStart.current, now)) {
        pinchStart.current = null;
        onPinchOut();
      }
      return;
    }
    if (!parallax || !root.current) return;
    const box = root.current.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * 2 - 1;
    root.current.style.setProperty("--px", px.toFixed(3));
  }

  function onPointerEnd(event: PointerEvent<HTMLElement>) {
    touches.current.delete(event.pointerId);
    if (touches.current.size < 2) pinchStart.current = null;
  }

  const gateCenter = scene.gate.x + scene.gate.w / 2;
  return (
    <nav
      ref={root}
      aria-label={label}
      className={styles.plaza}
      data-plaza=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={() => root.current?.style.setProperty("--px", "0")}
    >
      <p className={styles.caption} aria-hidden="true">
        {caption}
      </p>
      <div className={styles.canvas} style={{ blockSize: scene.height }}>
        <svg
          className={styles.scenery}
          width={scene.width}
          height={scene.height}
          viewBox={`0 0 ${scene.width} ${scene.height}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <radialGradient id="plaza-gate-glow">
              <stop offset="0" stopColor="var(--gold)" stopOpacity="0.45" />
              <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="plaza-door-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--forest-800)" />
              <stop offset="0.7" stopColor="var(--forest-950)" />
              <stop offset="1" stopColor="var(--night)" />
            </linearGradient>
          </defs>
          <g className={styles.row} style={vars({ "--parallax": 0.2 })}>
            <ellipse
              cx={gateCenter}
              cy={scene.gate.y + scene.gate.h * 0.6}
              rx={scene.gate.w * 1.6}
              ry={scene.gate.h * 0.9}
              fill="url(#plaza-gate-glow)"
            />
            {scene.streets.map((street) => {
              const lit = scene.doors[street.door]?.lit ?? false;
              return (
                <line
                  key={street.door}
                  data-plaza-street=""
                  x1={street.from[0]}
                  y1={street.from[1]}
                  x2={street.to[0]}
                  y2={street.to[1]}
                  stroke={street.color}
                  strokeWidth={street.width}
                  strokeOpacity={lit ? 0.32 : 0.1}
                  strokeLinecap="round"
                />
              );
            })}
            <path
              data-plaza-gate=""
              d={DOOR_PATH}
              transform={doorTransform(scene.gate)}
              fill="url(#plaza-door-fill)"
              stroke="url(#darb-gold-stroke)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
          {scene.rows.map((row) => (
            <g key={row.index} className={styles.row} style={vars({ "--parallax": row.parallax })}>
              {row.doors.map((i) => {
                const door = scene.doors[i]!;
                const cx = door.frame.x + door.frame.w / 2;
                return (
                  <g key={door.slug} opacity={door.lit ? 1 : 0.55}>
                    <ellipse
                      cx={cx}
                      cy={door.frame.y + door.frame.h}
                      rx={door.frame.w * 0.7}
                      ry={door.frame.w * 0.16}
                      fill={door.accent}
                      opacity={door.lit ? 0.16 : 0.05}
                    />
                    <path
                      data-plaza-frame=""
                      d={DOOR_PATH}
                      transform={doorTransform(door.frame)}
                      fill="url(#plaza-door-fill)"
                      stroke="url(#darb-gold-stroke)"
                      strokeWidth={1.25}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={cx}
                      y={door.frame.y + door.frame.h * 0.66}
                      textAnchor="middle"
                      fontSize={Math.max(12, Math.round(door.frame.w * 0.26))}
                      fontWeight={700}
                      style={{ fill: door.lit ? "var(--gold-300)" : "var(--text-muted)" }}
                    >
                      {countText(door.count)}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
        <ol className={styles.links} dir="ltr">
          {scene.doors.map((door) => (
            <li
              key={door.slug}
              className={styles.item}
              style={vars({
                insetInlineStart: `${door.hit.x}px`,
                insetBlockStart: `${door.hit.y}px`,
                inlineSize: `${door.hit.w}px`,
                blockSize: `${door.hit.h}px`,
                "--parallax": scene.rows[door.row]?.parallax ?? 1,
              })}
            >
              <Link
                href={door.href}
                prefetch={false}
                className={styles.door}
                data-plaza-door={door.slug}
                data-count={door.count}
                data-empty={door.count === 0 ? "" : undefined}
              >
                <span className={styles.label} dir={scene.dir}>
                  {door.label}
                </span>
                <span className="visually-hidden">{countLabel(door.count)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
