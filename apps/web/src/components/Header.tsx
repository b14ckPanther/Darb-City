import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { nav } from "@/content/nav";
import { href, paths } from "@/lib/routes";
import { BrandMark } from "./BrandMark";
import { SearchBar } from "./SearchBar";
import { SiteNav } from "./SiteNav";
import { ThemeToggle } from "./ThemeToggle";
import { themeCopy } from "@/lib/theme";
import styles from "./Header.module.css";

export function Header({ locale, nearMe }: { locale: Locale; nearMe?: ReactNode }) {
  const copy = nav[locale];
  return (
    <header id="site-header" className={styles.header} data-site-header="">
      <div className={`frame ${styles.inner}`}>
        <BrandMark locale={locale} />
        <SearchBar locale={locale} nearMe={nearMe} />
        <div className={styles.navSlot}>
          <ThemeToggle {...themeCopy[locale]} />
          <SiteNav
            label={copy.label}
            menu={copy.menu}
            close={copy.close}
            tabs={[
              { href: href(locale), label: copy.home, match: "home" },
              { href: href(locale, paths.explore()), label: copy.city, match: "city" },
              { href: href(locale, paths.showroom()), label: copy.showroom, match: "/showroom" },
              { href: href(locale, paths.pricing()), label: copy.pricing, match: "/pricing" },
              {
                href: href(locale, paths.forBusiness()),
                label: copy.forBusiness,
                match: "/for-business",
              },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
