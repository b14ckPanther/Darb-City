/** Interface icons for the platform layers (business, app, search, map, people), 24 × 24, stroked. */
const PATHS = [
  // A shopfront with an awning.
  "M4 10v9h16v-9M3 6l1.5-3h15L21 6v2a2.5 2.5 0 0 1-4.5 1.5A2.5 2.5 0 0 1 12 9.5 2.5 2.5 0 0 1 7.5 9.5 2.5 2.5 0 0 1 3 8V6Zm7 13v-5h4v5",
  // A phone.
  "M8 2.5h8a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Zm3 16h2",
  // A magnifier with a spark.
  "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm4.8 11.3L20 20M10.5 7.5v2m0 2v2m-2-3h-2m6 0h-2",
  // A map pin.
  "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  // Two people.
  "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m2.5 15a5 5 0 0 0-3.5-4.8",
];

export function LayerIcon({ index }: { index: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[index % PATHS.length]} />
    </svg>
  );
}
