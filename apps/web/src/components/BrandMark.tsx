import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { href } from "@/lib/routes";
import styles from "./Header.module.css";

/** The approved raster mark (never redrawn) and the bilingual wordmark Darb / درب. */
export function BrandMark({ locale }: { locale: Locale }) {
  return (
    <Link href={href(locale)} className={styles.brand} aria-label={t(locale, "appName")}>
      <Image src="/brand/darb-mark-96.webp" alt="" width={36} height={42} unoptimized />
      <span className={styles.wordmark} aria-hidden="true">
        <span lang="en">Darb</span>
        <span className={styles.slash}>/</span>
        <span lang="ar">درب</span>
      </span>
    </Link>
  );
}
