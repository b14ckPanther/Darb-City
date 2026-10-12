import Link from "next/link";
import type { Chip } from "@/lib/crumbs";
import styles from "./List.module.css";

export function SubPlaceChips({ label, chips }: { label: string; chips: Chip[] }) {
  return (
    <nav aria-label={label} className={styles.chips}>
      <ul>
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              className={styles.chip}
              aria-current={chip.current ? "page" : undefined}
              data-chip={chip.key}
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
