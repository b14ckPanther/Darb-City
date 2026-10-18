import Link from "next/link";
import { pickText, type Locale } from "@darb/core";
import type { PlaceDto } from "@darb/contracts";
import { t } from "@darb/i18n";
import { INTL_TAG } from "@/lib/locale";
import { href, paths } from "@/lib/routes";
import { getKindCounts, getPlaceCounts } from "@/lib/api";
import { COUNTRY_SLUG } from "@/lib/levels";
import type { TaxonomyIndex } from "@/lib/taxonomy";
import { withBusinesses, withBusinessesTaxonomy } from "@/lib/visible";
import { sectorGroups } from "@/lib/categories";
import { formatNumber } from "@/lib/format";
import { KindRows } from "./Categories";
import styles from "./PlaceIndex.module.css";

export interface RegionGroup {
  slug: string;
  name: string;
  places: PlaceDto[];
}

function PlaceLinks({ locale, places }: { locale: Locale; places: PlaceDto[] }) {
  const collator = new Intl.Collator(INTL_TAG[locale]);
  const sorted = places
    .map((p) => ({ slug: p.slug, name: pickText(p.name, locale) }))
    .sort((a, b) => collator.compare(a.name, b.name));
  return (
    <ul className={styles.links}>
      {sorted.map((p) => (
        <li key={p.slug}>
          <Link href={href(locale, paths.place(p.slug))} className={styles.link}>
            {p.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Lists only places that have businesses; the rest stay reachable by link and search. */
export async function PlaceIndex({
  locale,
  regions: all,
}: {
  locale: Locale;
  regions: RegionGroup[];
}) {
  const counts = await getPlaceCounts();
  const regions = all
    .map((r) => ({ ...r, places: withBusinesses(r.places, counts) }))
    .filter((r) => r.places.length > 0);
  return (
    <section id="places" aria-labelledby="places-title" className={styles.section}>
      <h2 id="places-title" className={styles.heading}>
        {t(locale, "places")}
      </h2>
      {regions.length === 0 ? <p className="lede">{t(locale, "nothingListedYet")}</p> : null}
      {regions.map((region) => {
        const of = (type: PlaceDto["type"]) => region.places.filter((p) => p.type === type);
        const towns = of("town");
        const villages = of("village");
        return (
          <div key={region.slug} className={styles.region}>
            <h3 className={styles.regionName}>{region.name}</h3>
            <p className={styles.groupLabel}>{t(locale, "cities")}</p>
            <PlaceLinks locale={locale} places={of("city")} />
            {towns.length > 0 ? (
              <details className={styles.details}>
                <summary className={styles.summary}>
                  {t(locale, "towns")} <span className={styles.count}>{towns.length}</span>
                </summary>
                <PlaceLinks locale={locale} places={towns} />
              </details>
            ) : null}
            {villages.length > 0 ? (
              <details className={styles.details}>
                <summary className={styles.summary}>
                  {t(locale, "villages")} <span className={styles.count}>{villages.length}</span>
                </summary>
                <PlaceLinks locale={locale} places={villages} />
              </details>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

/**
 * Every kind with businesses somewhere in the country, by sector: the busiest sector first, and in
 * each, one kind per row with its count, busiest first.
 */
export async function KindIndex({ locale, index: all }: { locale: Locale; index: TaxonomyIndex }) {
  const counts = (await getKindCounts(COUNTRY_SLUG)) ?? {};
  const groups = sectorGroups(locale, withBusinessesTaxonomy(all, counts), counts);
  const count = (n: number) => formatNumber(n, locale);
  return (
    <section id="kinds" aria-labelledby="kinds-title" className={styles.section}>
      <h2 id="kinds-title" className={styles.heading}>
        {t(locale, "allKinds")}
      </h2>
      {groups.length === 0 ? <p className="lede">{t(locale, "nothingListedYet")}</p> : null}
      <div className={styles.sectors}>
        {groups.map((group) => (
          <details key={group.sector.slug} className={styles.details}>
            <summary className={styles.summary}>
              <span>{group.name}</span>
              <span className={styles.tagline}>{group.tagline}</span>
            </summary>
            <KindRows
              kinds={group.kinds}
              href={(kind) => href(locale, paths.nationalKind(kind))}
              accent={group.sector.accent}
              countText={count}
              countLabel={(n) => t(locale, "businessCount", { count: count(n) })}
              label={group.name}
              card
            />
          </details>
        ))}
      </div>
    </section>
  );
}
