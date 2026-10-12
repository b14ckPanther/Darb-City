import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { href, paths } from "@/lib/routes";
import { BrandMark } from "./BrandMark";
import { SearchBar } from "./SearchBar";
import styles from "./Header.module.css";

export function Header({ locale, nearMe }: { locale: Locale; nearMe?: ReactNode }) {
  return (
    <header id="site-header" className={styles.header} data-site-header="">
      <div className={`frame ${styles.inner}`}>
        <BrandMark locale={locale} />
        <SearchBar locale={locale} nearMe={nearMe} />
        <Link href={href(locale, paths.forBusiness())} className={styles.forBusiness}>
          {t(locale, "forBusiness")}
        </Link>
      </div>
    </header>
  );
}
