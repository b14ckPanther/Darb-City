import styles from "./Badges.module.css";

export function ExampleBadge({ label }: { label: string }) {
  return (
    <span className={styles.example} data-example-badge="">
      {label}
    </span>
  );
}

/** A fully gluten-free kitchen, safe for celiac disease (Task 27b); never "has an option". */
export function GlutenFreeBadge({ label }: { label: string }) {
  return (
    <span className={styles.glutenFree} data-gluten-free="">
      {label}
    </span>
  );
}

/** Visits by arrangement only (Task 28): said instead of open or closed. */
export function AppointmentBadge({ label }: { label: string }) {
  return (
    <span className={styles.open} data-appointment="">
      {label}
    </span>
  );
}

export function OpenState({
  openNow,
  labels,
}: {
  openNow: boolean | null;
  labels: { open: string; closed: string };
}) {
  if (openNow === null) return null;
  return (
    <span className={styles.open} data-open={openNow ? "true" : "false"}>
      <span className={styles.dot} aria-hidden="true" />
      {openNow ? labels.open : labels.closed}
    </span>
  );
}
