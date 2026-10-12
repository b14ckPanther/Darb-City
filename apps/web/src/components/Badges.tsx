import styles from "./Badges.module.css";

export function ExampleBadge({ label }: { label: string }) {
  return (
    <span className={styles.example} data-example-badge="">
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
