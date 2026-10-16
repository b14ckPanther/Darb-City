import type { Metadata } from "next";
import { pickText, type Locale, type Localized } from "@darb/core";
import { CityBar } from "@/components/CityBar";
import { Footer } from "@/components/Footer";
import { JoinFlow, type PlaceOption } from "@/components/join/JoinFlow";
import type { PickerOption } from "@/components/join/SearchPicker";
import { foldText } from "@/lib/fold-text";
import { join } from "@/content/join";
import { getJoinStatus, getPlaces, getTaxonomy } from "@/lib/api";
import { crumbsFor } from "@/lib/crumbs";
import { localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import { orUnavailable } from "@/lib/unavailable";
import styles from "@/components/Contact.module.css";

/** Kinds and towns change with admin writes (tags); uploads and the lookup can switch any minute. */
export const revalidate = 60;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  return pageMetadata({
    locale,
    segments: paths.join(),
    title: join[locale].title,
    description: join[locale].lead,
  });
}

/** Every name a thing has, folded, so a town is found by any spelling. */
const searchText = (name: Localized, extra: string[] = []) =>
  foldText([...Object.values(name), ...extra].filter(Boolean).join(" | "));

const byLabel = (locale: Locale) => (a: PickerOption, b: PickerOption) =>
  a.label.localeCompare(b.label, locale);

/** "Put me on Darb": a business owner finds their business and sends its card for review. */
export default orUnavailable(async function JoinPage({ params }: Props) {
  const locale = localeOrNotFound((await params).locale);
  const [taxonomy, settlements, status] = await Promise.all([
    getTaxonomy(),
    getPlaces(),
    getJoinStatus(),
  ]);
  const kinds: PickerOption[] = taxonomy.sectors
    .flatMap((s) =>
      s.kinds.map((k) => ({
        slug: k.slug,
        label: pickText(k.name, locale),
        search: searchText(k.name, [k.slug.replace(/-/g, " "), pickText(s.name, locale)]),
      })),
    )
    .sort(byLabel(locale));
  const places: PlaceOption[] = settlements
    .map((p) => ({
      slug: p.slug,
      label: pickText(p.name, locale),
      search: searchText(p.name, [p.slug.replace(/-/g, " ")]),
      lat: p.lat,
      lng: p.lng,
    }))
    .sort(byLabel(locale));
  const copy = join[locale];
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, {
          page: { label: copy.title, href: href(locale, paths.join()) },
        })}
        segments={paths.join()}
      />
      <main id="main" className="frame reveal">
        <header className={styles.hero}>
          <h1 id="main-heading" tabIndex={-1} className={`page-title ${styles.title}`}>
            {copy.title}
          </h1>
          <p className={`lede ${styles.intro}`}>{copy.lead}</p>
        </header>
        <JoinFlow
          locale={locale}
          copy={copy}
          kinds={kinds}
          places={places}
          uploads={status.uploads}
          homeHref={href(locale)}
        />
      </main>
      <Footer locale={locale} segments={paths.join()} />
    </>
  );
});
