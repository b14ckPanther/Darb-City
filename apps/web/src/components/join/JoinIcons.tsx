/**
 * The card's small icon set, monochrome and drawn in currentColor. Generic glyphs (phone, globe,
 * clock, pin) are line drawings; the brands (WhatsApp, Instagram, Facebook, TikTok, Waze) are
 * simple recognisable marks drawn for Darb, not the companies' artwork.
 */
export type JoinIconName =
  "phone" | "whatsapp" | "waze" | "instagram" | "facebook" | "tiktok" | "globe" | "pin" | "clock";

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Glyph({ name }: { name: JoinIconName }) {
  switch (name) {
    case "phone":
      return (
        <path
          {...line}
          d="M6.6 3.5h2.6l1.3 3.6-1.8 1.4a12 12 0 0 0 6.8 6.8l1.4-1.8 3.6 1.3v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"
        />
      );
    case "globe":
      return (
        <g {...line}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
        </g>
      );
    case "clock":
      return (
        <g {...line}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </g>
      );
    case "pin":
      return (
        <g {...line}>
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
          <circle cx="12" cy="10" r="2.3" />
        </g>
      );
    case "whatsapp":
      return (
        <g>
          <path {...line} d="M4 20l1.2-3.8A8.5 8.5 0 1 1 8 19Z" />
          <path
            fill="currentColor"
            d="M9.3 8.2c.3 2.2 2.4 4.6 4.6 5.2l1.1-1.1 1.8.8-.3 1.4c-3.2.3-7.3-3.7-7.3-7.1l1.4-.3.8 1.8Z"
          />
        </g>
      );
    case "instagram":
      return (
        <g {...line}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none" />
        </g>
      );
    case "facebook":
      return (
        <path
          fill="currentColor"
          d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21Z"
        />
      );
    case "tiktok":
      return (
        <path
          fill="currentColor"
          d="M14.5 3c.4 2.6 2 4.2 4.5 4.4v3a7.6 7.6 0 0 1-4.4-1.4v6.3A5.6 5.6 0 1 1 9 9.7v3.1a2.6 2.6 0 1 0 2.5 2.6V3Z"
        />
      );
    case "waze":
      return (
        <g>
          <path
            {...line}
            d="M6.3 17.6C4.2 17.2 3 15.9 3 14.4c1 0 1.6-.7 1.6-2.2C4.6 7.6 8.1 4 12.4 4c4.5 0 8.1 3.4 8.1 7.7 0 3-1.8 5.3-4.4 6.4M9.6 18.6h3.8"
          />
          <circle cx="8" cy="18.6" r="1.7" fill="currentColor" />
          <circle cx="15.1" cy="18.6" r="1.7" fill="currentColor" />
          <circle cx="10.2" cy="10.2" r="1" fill="currentColor" />
          <circle cx="15" cy="10.2" r="1" fill="currentColor" />
          <path {...line} d="M10 13.2c1.2 1.1 3.5 1.1 4.7 0" />
        </g>
      );
  }
}

export function JoinIcon({ name, size = 20 }: { name: JoinIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <Glyph name={name} />
    </svg>
  );
}
