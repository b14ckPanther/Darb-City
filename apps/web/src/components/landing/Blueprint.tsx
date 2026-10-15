import type { CSSProperties } from "react";

const at = (d: number) => ({ "--d": `${d}s` }) as CSSProperties;

/**
 * The construction drawing the mark is built from on arrival: a grid, the isometric guide, the
 * arch's two edges, the corner radii and a few measurements. It sits in the mark's own 480 × 528
 * box, so the lines land on the real mark. Every stroke has pathLength 1 for the draw animation.
 */
export function Blueprint({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 480 528" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="darb-blueprint-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect data-grid="" width="480" height="528" fill="url(#darb-blueprint-grid)" />
      <g data-lines="" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path pathLength={1} style={at(0.3)} d="M250 24L448 128V420L250 524L32 420V128Z" />
        <path pathLength={1} style={at(0.5)} strokeDasharray="0.01 0.02" d="M250 0V528" />
        <path pathLength={1} style={at(0.7)} d="M32 128L250 236L448 128M250 236V524" />
        <path pathLength={1} style={at(1)} d="M188 500V285C188 240 215 215 250 196L392 112" />
        <path pathLength={1} style={at(1.2)} d="M252 512V312C252 285 268 268 292 255L350 222" />
        <path pathLength={1} style={at(1.4)} d="M447 140V428" />
        <circle pathLength={1} style={at(1.5)} cx="74" cy="142" r="42" />
        <circle pathLength={1} style={at(1.6)} cx="250" cy="300" r="62" />
        <path pathLength={1} style={at(1.7)} d="M188 516H252M188 510V522M252 510V522" />
      </g>
      <g
        data-labels=""
        direction="ltr"
        fill="currentColor"
        fontSize="11"
        fontFamily="ui-monospace, monospace"
      >
        <text x="196" y="508">
          64
        </text>
        <text x="300" y="104">
          30°
        </text>
        <text x="40" y="96">
          r 42
        </text>
        <text x="322" y="306">
          ⌀ 124
        </text>
        <text x="456" y="280">
          292
        </text>
      </g>
    </svg>
  );
}
