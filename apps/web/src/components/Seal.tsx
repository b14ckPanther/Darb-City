/**
 * Darb's gold seal: a round stamp with a check, for "done" moments (a capture sent, a milestone, an
 * approval). Never the arch, which belongs to the Darb mark. Colour comes from `currentColor`.
 */
export function Seal({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-seal=""
    >
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle
        cx="32"
        cy="32"
        r="23.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="1.5 3.2"
        strokeLinecap="round"
      />
      <path
        d="M21 33.5 28.5 41 44 25"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        data-check=""
      />
    </svg>
  );
}
