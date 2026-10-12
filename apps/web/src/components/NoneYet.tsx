import Link from "next/link";
import styles from "./List.module.css";

export interface NearbyPlace {
  key: string;
  name: string;
  href: string;
  distance: string;
}

export function NoneYet({
  title,
  subtitle,
  places,
}: {
  title: string;
  subtitle: string;
  places: NearbyPlace[];
}) {
  return (
    <section className={styles.none} aria-labelledby="none-yet-title" data-none-yet="">
      <h2 id="none-yet-title">{title}</h2>
      {places.length > 0 ? (
        <>
          <p>{subtitle}</p>
          <ul className={styles.nearest}>
            {places.map((p) => (
              <li key={p.key}>
                <Link href={p.href} data-nearest-place={p.key}>
                  <span>{p.name}</span>
                  <span className={styles.distance}>{p.distance}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
