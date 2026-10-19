import type { ReactNode } from "react";

/**
 * The screens' one icon language, drawn like Station's: 24px, stroke only, round caps. Interface
 * glyphs, not illustrations. A label finds its glyph by its English text (the seed, the import and
 * the admin all write English labels); anything unknown keeps the plain dot.
 */

const c = (cx: number, cy: number, r: number) => <circle cx={cx} cy={cy} r={r} />;

export const GLYPHS = {
  dot: c(12, 12, 3),
  cup: (
    <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Zm12 1h1.5a2.5 2.5 0 0 1 0 5H16M3 21h14M8 2.5c0 1 1 1.5 1 2.5S8 6.5 8 6.5m4-4c0 1 1 1.5 1 2.5s-1 1.5-1 1.5" />
  ),
  bread: (
    <path d="M6 11.5A3.5 3.5 0 0 1 4.5 5C6 3.8 8.8 3 12 3s6 .8 7.5 2a3.5 3.5 0 0 1-1.5 6.5V20H6v-8.5ZM9.5 8.5l1 2m3-2-1 2" />
  ),
  icecream: <path d="M7 10a5 5 0 0 1 10 0M6 10h12l-6 11-6-11Zm3.5 4.5 3 3m-1.5-7.5 4.5 4.5" />,
  pizza: (
    <path d="M12 21 3.5 6.6a16 16 0 0 1 17 0L12 21ZM5.6 10.2a12 12 0 0 1 12.8 0M10 12.5h.01M14 13.5h.01M12 17h.01" />
  ),
  burger: (
    <path d="M4 11a8 6.5 0 0 1 16 0H4Zm-1 3.5h18M4 17.5h16a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5ZM9 7.5h.01M12.5 6.5h.01M15 8h.01" />
  ),
  skewer: (
    <path d="M3 21 21 3M7 13.6l3.4 3.4-2 2L5 15.6l2-2Zm4-4 3.4 3.4-2 2L9 11.6l2-2Zm4-4 3.4 3.4-2 2L13 7.6l2-2Z" />
  ),
  fish: <path d="M3 12c3-5 9-6.5 13-2l5-3v10l-5-3c-4 4.5-10 3-13-2Zm5-1h.01" />,
  noodles: <path d="M3 11h18a9 9 0 0 1-18 0Zm5 10h8M14 2.5 12 9m6.5-6L14 9M7 11c0-2 1.5-2 1.5-4" />,
  bowl: (
    <path d="M3 11h18a9 9 0 0 1-18 0Zm5 10h8M9 7.5c0-1.5 1.5-1.5 1.5-3m3 3c0-1.5 1.5-1.5 1.5-3" />
  ),
  cake: (
    <path d="M4 21h16M5 21v-7h14v7M5 16.5c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0M12 14v-3m0-3a1 1 0 0 1-1-1c0-1 1-2.5 1-2.5s1 1.5 1 2.5a1 1 0 0 1-1 1Zm-4.5 6v-2m9 2v-2" />
  ),
  plate: (
    <path d="M12.5 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-3a3 3 0 1 0 0-6M2.5 4v4a1.5 1.5 0 0 0 3 0V4M4 9.5V20m17.5 0V4C19.9 4.6 19 6.6 19 10h2.5" />
  ),
  pot: (
    <path d="M4 10h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7Zm-2 0h20M9 7c0-1.5 1.5-1.5 1.5-3m3 3c0-1.5 1.5-1.5 1.5-3" />
  ),
  juice: <path d="M6 8h12l-1.5 13h-9L6 8Zm6 0 3-6m-8.5 10h11" />,
  leaf: <path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15Zm0 0 8-8" />,
  wheat: (
    <path d="M12 21V8m0 0c-2-1-3-3-3-5 2 0 3 2 3 5Zm0 0c2-1 3-3 3-5-2 0-3 2-3 5Zm0 5c-2-1-4-2.5-4-4.5 2 0 4 2 4 4.5Zm0 0c2-1 4-2.5 4-4.5-2 0-4 2-4 4.5Zm0 5c-2-1-4-2.5-4-4.5 2 0 4 2 4 4.5Zm0 0c2-1 4-2.5 4-4.5-2 0-4 2-4 4.5Z" />
  ),
  bag: <path d="M4 9h16l-1 11H5L4 9Zm4 0V7a4 4 0 0 1 8 0v2" />,
  sun: (
    <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-14v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  ),
  scooter: (
    <path d="M6 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm12 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8.5 17H14l2.5-9H13m3.5 0 1.5 9M3 10h6v4" />
  ),
  access: (
    <path d="M11 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10 7v7h6l3 6m-9-10h5m-8 1a5 5 0 1 0 7 7" />
  ),
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2" />,
  coin: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />,
  store: (
    <path d="m3 9 1.5-5h15L21 9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 11.5V21h14v-9.5M10 21v-5h4v5" />
  ),
  tag: <path d="M3 12V4h8l10 10-8 8-10-10Zm4.5-3.5h.01" />,
  cart: (
    <path d="M3 4h2l2.4 11h11L21 7H6.2M9 20.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
  ),
  hanger: (
    <path d="M10 5a2 2 0 1 1 2 2v2m0 0-9 6a1.5 1.5 0 0 0 1 2.7h16a1.5 1.5 0 0 0 1-2.7l-9-6Z" />
  ),
  pill: <path d="M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7l-6 6Zm-2-12 7 7" />,
  book: <path d="M4 19V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14v-4M8 7h8" />,
  bike: (
    <path d="M5.5 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm13 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-13-3.5L9 8h6.5l3 6.5M9 8l3.5 6.5h-7M8 5h3m4.5 3-1-3H17" />
  ),
  paw: (
    <>
      <path d="M12 20c-3 0-5-1.4-5-3.4S9.5 12 12 12s5 2.6 5 4.6-2 3.4-5 3.4Z" />
      {c(5.5, 10, 1.8)}
      {c(9.5, 5.8, 1.8)}
      {c(14.5, 5.8, 1.8)}
      {c(18.5, 10, 1.8)}
    </>
  ),
  blocks: <path d="M4 13h7v7H4v-7Zm9 0h7v7h-7v-7ZM8.5 4h7v7h-7V4Z" />,
  sofa: (
    <path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2v-5Zm3 5v2m14-2v2" />
  ),
  bottle: <path d="M9.5 3h5v3h-5V3ZM8 6h8l1 3v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9l1-3Zm-1 6h10" />,
  gear: (
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 3a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-16v4m0 12v4M4.9 4.9l2.8 2.8m8.6 8.6 2.8 2.8M2 12h4m12 0h4M4.9 19.1l2.8-2.8m8.6-8.6 2.8-2.8" />
  ),
  gift: (
    <path d="M4 11h16v10H4V11ZM3 7h18v4H3V7Zm9 0v14m0-14C10 7 7.5 6 7.5 4.5S9.5 2.5 12 7Zm0 0c2 0 4.5-1 4.5-2.5S14.5 2.5 12 7Z" />
  ),
  scissors: (
    <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2.5-13.5L20 18M8.5 16.5 20 6" />
  ),
  tooth: (
    <path d="M7 3C4.5 3 3 5 3 7.5c0 3 1.5 4.5 2 7 .5 3 1 6.5 3 6.5s2-4 4-4 2 4 4 4 2.5-3.5 3-6.5c.5-2.5 2-4 2-7C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3Z" />
  ),
  stethoscope: (
    <>
      <path d="M5 3v5a5 5 0 0 0 10 0V3M10 13v2a5 5 0 0 0 10 0v-2M4 3h2m8 0h2" />
      {c(20, 11, 2)}
    </>
  ),
  cross: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" />,
  racket: <path d="M15 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-4.2-1.8L3.5 20.5M9 9h12m-6-6v12" />,
  ball: (
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14 4 3-1.5 4.5h-5L8 10l4-3Zm0-4v4m9 3h-5M3 10h5m-1 10 2.5-5.5M17 20l-2.5-5.5" />
  ),
  tent: <path d="M2 20h20M12 4 3.5 20M12 4l8.5 16M12 20l-3-6h6l-3 6" />,
  scales: (
    <path d="M12 3v18m-5 0h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7Zm14 0-3 7a3 3 0 0 0 6 0l-3-7Z" />
  ),
  people: (
    <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6.5 9a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4m2 3.3a6.5 6.5 0 0 1 3.5 6" />
  ),
  sprout: (
    <path d="M12 21v-9m0 0C12 8 9 5 4 5c0 4 3 7 8 7Zm0 0c0-3 2.5-6 7.5-6 0 3.5-2.5 6-7.5 6ZM7 21h10" />
  ),
  flower: (
    <>
      <path d="M12 21v-7m0 4c-2.5 0-4.5-1.5-5-3.5 2.5 0 4.5 1.5 5 3.5Zm0 0c2.5 0 4.5-1.5 5-3.5-2.5 0-4.5 1.5-5 3.5ZM12 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
      {c(12, 7, 1.2)}
    </>
  ),
  cap: <path d="m2 9 10-5 10 5-10 5L2 9Zm4 2v5c0 1.5 3 3 6 3s6-1.5 6-3v-5m4-2v6" />,
  bed: (
    <>
      <path d="M3 5v15m0-4h18v4m0-4v-4a3 3 0 0 0-3-3h-7v7" />
      {c(7, 12, 2)}
    </>
  ),
  bank: <path d="M3 5h18v3H3V5Zm2 3v10m4.7-10v10m4.6-10v10M19 8v10M3 21h18M4 18h16" />,
  phone: (
    <path d="M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm4 16h2" />
  ),
  carwash: (
    <path d="m4 15 2-5h12l2 5v4H4v-4Zm3 4v2m10-2v2M7 15h.01M17 15h.01M8 6c0-1.5 1-2.5 1-2.5S10 4.5 10 6a1 1 0 0 1-2 0Zm6 0c0-1.5 1-2.5 1-2.5s1 1 1 2.5a1 1 0 0 1-2 0Z" />
  ),
  car: <path d="m4 15 2-5h12l2 5v4H4v-4Zm3 4v2m10-2v2M7 15h.01M17 15h.01M7.5 7h9" />,
  id: (
    <path d="M3 5h18v14H3V5Zm4 5a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm-1 6c.5-1.5 1.7-2 3-2s2.5.5 3 2m2-7h4m-4 4h4" />
  ),
  shield: <path d="m12 3 8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Zm-3 9 2 2 4-4" />,
  calendar: <path d="M4 5h16v16H4V5Zm0 5h16M8 3v4m8-4v4" />,
  mountain: <path d="M2 20 9 7l4 7 3-4 6 10H2Zm5.5-10L9 12l2-2" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
  wrench: (
    <path d="M15 4a5 5 0 0 0-4.7 6.7l-6.7 6.7a2 2 0 0 0 3 3l6.7-6.7A5 5 0 0 0 20 9l-3 1-3-3 1-3Z" />
  ),
  hammer: <path d="m3.5 20.5 9-9m-.7-4.9 5.6 5.6-2.2 2.2-5.6-5.6 2.2-2.2Z" />,
  gem: <path d="M6 3h12l3 6-9 12L3 9l3-6ZM3 9h18M9 3l3 6 3-6m-3 6v12" />,
  bolt: <path d="M13 3 6 13h5l-1 8 7-10h-5l1-8Z" />,
  exchange: <path d="M4 8h15l-3.5-3.5M20 16H5l3.5 3.5" />,
  truck: (
    <path d="M2 5h12v11H2V5Zm12 4h4l3 3.5V16h-7M6 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
  ),
  printer: <path d="M7 8V3h10v5M7 17H3v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7h-4M7 14h10v7H7v-7Z" />,
  box: <path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10" />,
  heart: (
    <path d="M12 20s-8-4.5-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.5 12 20 12 20Z" />
  ),
  engine: (
    <path d="M3 10h3l2-2h6l2 2h2v2h1.5v-2H21v7h-1.5v-2H18v3h-3l-2 2H8l-2-2H3v-8Zm6-5h5m-2.5 0v3" />
  ),
  brush: (
    <path d="m18 3 3 3-9 9-3-3 9-9ZM9 12c-3 0-5 2-5 5 0 1.5-1 3-2 3 2 1 6 1 8-1 1.5-1.5 2-4-1-7Z" />
  ),
  tyre: (
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v5m0 8v5m-9-9h5m8 0h5" />
  ),
  snow: <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 3.5l3 2 3-2m-6 17 3-2 3 2" />,
  mail: <path d="M3 5h18v14H3V5Zm0 1 9 7 9-7" />,
  monitor: <path d="M3 4h18v12H3V4Zm5 16h8m-4-4v4" />,
  code: <path d="m8 8-5 4 5 4m8-8 5 4-5 4M14 4l-4 16" />,
  factory: <path d="M3 21V10l6 4v-4l6 4V5h4v16H3Zm4-4h2m3 0h2" />,
  camera: <path d="M3 8h4l2-3h6l2 3h4v12H3V8Zm9 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />,
  palette: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8Z" />
      {c(7.5, 11, 1.2)}
      {c(10, 7, 1.2)}
      {c(15, 7.5, 1.2)}
    </>
  ),
  square: <path d="M4 20V4l16 16H4Zm4-4v-2.5l2.5 2.5H8ZM4 8h2m-2 4h2" />,
  megaphone: <path d="M3 10v4h3l8 5V5l-8 5H3Zm15-1a4 4 0 0 1 0 6M6 14l1.5 6H10l-1-5.5" />,
  waves: (
    <path d="M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 13c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 18c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" />
  ),
  bus: (
    <path d="M5 3h14a1 1 0 0 1 1 1v13H4V4a1 1 0 0 1 1-1Zm-1 8h16M4 7h16M7 17v3m10-3v3m-9.5-6h.01m9 0h.01" />
  ),
  candle: (
    <path d="M12 3c1.5 2 2.5 3.2 2.5 4.5a2.5 2.5 0 0 1-5 0C9.5 6.2 10.5 5 12 3Zm-2 9h4v9h-4v-9Zm-3 9h10" />
  ),
  dumbbell: <path d="M6 7v10M3 9.5v5M18 7v10m3-7.5v5M6 12h12" />,
  parking: <path d="M4 3h16v18H4V3Zm6 14V7h3a3 3 0 0 1 0 6h-3" />,
  ticket: <path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6Zm11 0v2m0 3v2m0 3v2" />,
  balloon: (
    <path d="M12 15c3.3 0 6-3 6-6.5S15.3 3 12 3 6 5 6 8.5 8.7 15 12 15Zm0 0-1 2h2l-1-2Zm0 2c0 2-2 2-2 4" />
  ),
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />,
  speech: <path d="M4 5h16v11H9l-5 4V5Zm4 4h8m-8 3h5" />,
  laptop: <path d="M5 5h14v10H5V5Zm-2 14h18l-2-4H5l-2 4Z" />,
  key: <path d="M8 15.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm3.5-4H21v3m-3-3v3" />,
  glasses: (
    <path d="M6.5 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm11 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM10 13.5c1.2-1 2.8-1 4 0M3 13.5 2 8m19 5.5L22 8" />
  ),
  meat: (
    <>
      <path d="M15 4c3.5 0 6 2.5 6 6 0 4.5-4.5 8-10 9-3.5.5-8-.5-8-3.5 0-2.5 2.5-3 4-5.5S10.5 4 15 4Z" />
      {c(15, 10, 1.6)}
    </>
  ),
  doc: <path d="M6 3h8l4 4v14H6V3Zm8 0v4h4M9 12h6m-6 4h6" />,
  clipboard: <path d="M8 3h8v3H8V3ZM6 4.5H5V21h14V4.5h-1M9 13l2 2 4-4" />,
  lock: <path d="M5 11h14v10H5V11Zm3 0V8a4 4 0 0 1 8 0v3m-4 4v2" />,
  music: (
    <path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  ),
  watch: <path d="m8 6 1-3h6l1 3M8 18l1 3h6l1-3m-4 0a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-9v3l2 1" />,
} satisfies Record<string, ReactNode>;

export type GlyphName = keyof typeof GLYPHS;

/**
 * English label → glyph, most specific first. Shared by every template, so a "Car wash" reads the
 * same on a pass, a tracker or a shop. Each template may put its own rules in front (Station did).
 */
export const GLYPH_RULES: [GlyphName, RegExp][] = [
  // Amenities and facts first: these words also appear inside longer labels.
  ["access", /wheelchair|accessib/i],
  ["clock", /24\s*\/\s*7|24 hours|open all day|^\d{1,2}:\d{2}/i],
  ["bag", /take ?away|takeout|pickup|to go|luggage|bags?\b/i],
  ["scooter", /deliver/i],
  ["sun", /outdoor|terrace|garden seating|sunrise/i],
  ["wheat", /gluten/i],
  ["leaf", /vegan|vegetarian|salad|organic/i],
  ["exchange", /currency|exchange/i],
  ["coin", /^[₪$€]\s?\d|^\d[\d,.]*\s?[₪$€]/i],
  // Food and drink.
  ["icecream", /ice ?cream|gelato|frozen yogh?urt/i],
  ["cup", /coffee|caf[eé]|espresso|latte|cortado|flat white|tea\b|drinks?\b/i],
  ["juice", /juice|smoothie/i],
  ["bread", /bread|bak(e|ery)|pastr|croissant|challah|pita|laffa|bun\b|maamoul/i],
  ["cake", /cake|sweet|dessert|chocolate|baklava|knafeh|kunafa|qatayef|candy|patisserie/i],
  ["pizza", /pizza/i],
  ["burger", /burger|hot ?dog|fries|american/i],
  ["skewer", /grill|kebab|shish|skewer|shawarma|bbq|barbecue|steak|chicken/i],
  ["fish", /fish|seafood|sea food/i],
  ["noodles", /sushi|asian|japan|chin(a|ese)|thai|korean|vietnam|ramen|noodle|indian/i],
  ["bowl", /hummus|falafel|\bful\b|soup|bowl/i],
  ["meat", /meat|butcher|lamb|calf|udhiyah|aqiqah/i],
  [
    "pot",
    /home ?(food|cook)|local food|arab|lebanese|middle eastern|mediterranean|georgian|caucasian|turkish|ethiopian|cuisine|catering|kitchen|houseware|cook/i,
  ],
  [
    "plate",
    /meal|restaurant|breakfast|lunch|dinner|sandwich|schnitzel|pasta|italian|french|international|eat in|dine/i,
  ],
  // Shops.
  [
    "cart",
    /supermarket|grocer|market|convenience|kiosk|variety|general store|wholesale|department|mall/i,
  ],
  [
    "hanger",
    /cloth|fashion|dress|abaya|hijab|thobe|shoe|wear\b|boutique|tailor|dry clean|alteration/i,
  ],
  ["pill", /pharm|prescription|drug ?store/i],
  ["book", /book|library|stationer|quran|torah|talmud|yeshiva/i],
  ["bike", /bike|bicycle|cycl/i],
  ["paw", /pet|vet\b|vet |veterin|animal/i],
  ["sofa", /furniture|sofa|decor|upholster|curtain|fabric/i],
  ["bottle", /perfume|cosmetic|beauty|skin|nail|cream|mask|lotion|dairy|milk|oil/i],
  ["scissors", /hair|barber|cut\b|haircut|salon|sewing/i],
  ["blocks", /toy|kindergarten|daycare|nursery school|kids|children|baby|nann/i],
  ["gift", /gift|favour|souvenir|wrapping/i],
  ["music", /music|instrument/i],
  ["watch", /watch/i],
  ["gem", /gold|jewel|diamond|silver/i],
  // Care and services.
  ["tooth", /dent|tooth|teeth|orthodont/i],
  ["cross", /emergency|urgent|first aid|hospital/i],
  ["stethoscope", /clinic|health|doctor|medic|speciali(st|ties)|pediatric|physio|therap|nursing/i],
  ["glasses", /optic|glasses|lens/i],
  ["racket", /padel|tennis|squash/i],
  ["dumbbell", /gym|fitness|crossfit|trainer|martial|boxing|weights/i],
  ["ball", /sport|football|soccer|basketball/i],
  ["waves", /pool|swim|aquatic|water park|beach/i],
  ["tent", /camp/i],
  ["mountain", /hik|trail|stream|mount|nature|walk/i],
  ["scales", /law|lawyer|legal|attorney|notary|mazoun/i],
  [
    "cap",
    /school|college|universit|campus|degree|vocational|course|tutor|study|education|primary|high school|middle school|ulpana|academy/i,
  ],
  [
    "candle",
    /mosque|synagogue|church|prayer|khalwa|worship|cemetery|funeral|janazah|denomination|fajr|dhuhr|asr|maghrib|isha/i,
  ],
  ["people", /communit|youth|senior|scout|volunteer|member|club house|recruit/i],
  ["laptop", /cowork|laptop/i],
  ["sprout", /plant|garden|seed|farm|produce|agricult|nursery|egg|olive/i],
  ["flower", /flower|florist|bouquet/i],
  ["speech", /language|consult|advice|problem/i],
  ["bed", /hotel|guest ?house|hostel|rooms\b|stay|zimmer|b&b/i],
  ["mail", /post office|postal|mail/i],
  ["bank", /bank|council|municipal|office|ministry of/i],
  ["phone", /phone|mobile|electronic|cellular/i],
  ["monitor", /computer|\bit\b|it support|software|saas|tech|digital|web/i],
  ["code", /cod(e|ing)|robot|app develop|program/i],
  ["camera", /photo|video|studio|film/i],
  ["palette", /\bart\b|artist|handmade|paint(ing)?\b|makeup|brow|henna|craft/i],
  ["square", /architect|interior|design|blueprint/i],
  ["megaphone", /marketing|advertis|social media|sign/i],
  ["balloon", /event|party|decor|balloon|venue|hall|wedding/i],
  ["ticket", /tour|ticket|escape|entry|admission|plan\b|travel|attraction/i],
  ["parking", /parking|car park/i],
  ["carwash", /car ?wash/i],
  ["drop", /wash|clean|water|spa|massage|hijama/i],
  ["engine", /engine|diesel|petrol|gearbox|exhaust|radiator|autotech|service\b|km service/i],
  ["brush", /body ?work|paint|dent repair|spray/i],
  ["tyre", /tyre|tire|wheel|alignment|suspension/i],
  ["bolt", /electric|ev\b|charg|solar|power|plumbing|breaker/i],
  ["snow", /air condition|\bac\b|cooling|refrigerat/i],
  ["key", /rental|rent a|locksmith|real estate|key/i],
  ["gear", /parts|spare/i],
  ["car", /\bcar\b|cars|vehicle|auto|taxi|motor|scooter|dealer|driving/i],
  ["truck", /truck|tractor|forklift|quad|machinery|mover|courier|shipping|logistic/i],
  ["bus", /bus|train|station|transport/i],
  ["box", /warehouse|storage|packag|box/i],
  ["printer", /print|copy|copying/i],
  ["clipboard", /check|test|inspection|diagnos|licens|registration|permit/i],
  ["id", /symbol|number|\bno\b|id\b|licence|license/i],
  ["shield", /supervis|insur|secur|guard|cyber|protect/i],
  ["calendar", /closed on|days|week|\b(sun|mon|tue|wed|thu|fri|sat)(day)?\b/i],
  ["lock", /lock|safe/i],
  [
    "hammer",
    /renovat|build|construct|hardware|carpent|metal|aluminium|glass|contract|tools|repair/i,
  ],
  ["factory", /factory|industr|manufactur|workshop/i],
  ["heart", /nonprofit|charity|donat|waqf|zakat|volunteer|qard|give|giving|cause/i],
  ["doc", /document|visa|form|account|tax|insurance agency/i],
  ["store", /chain|shop|store|branch type/i],
  ["star", /\bstars?\b|rating/i],
];

/** The first rule a label meets, or null (the template then shows its plain dot). */
export function glyphFor(
  en: string | undefined,
  rules: readonly [GlyphName, RegExp][] = GLYPH_RULES,
): GlyphName | null {
  if (!en) return null;
  return rules.find(([, re]) => re.test(en))?.[0] ?? null;
}

export function Glyph({ name, className }: { name: GlyphName; className?: string | undefined }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[name]}
    </svg>
  );
}
