import type { Metadata } from "next";
import { t } from "@darb/i18n";
import { rowLabels } from "@/components/BusinessList";
import { CityBar } from "@/components/CityBar";
import { Footer } from "@/components/Footer";
import { NearYou } from "@/components/NearYou";
import { near } from "@/content/near";
import { crumbsFor } from "@/lib/crumbs";
import { localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";

export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  return {
    ...pageMetadata({
      locale,
      segments: paths.near(),
      title: near[locale].title,
      description: near[locale].lead,
    }),
    // A different list for every visitor: nothing here for a search engine.
    robots: { index: false },
  };
}

/**
 * The businesses around where the visitor stands. A static shell: the point lives only in the
 * visitor's tab (sessionStorage), so the list is fetched by the browser and nothing is cached.
 */
export default async function NearPage({ params }: Props) {
  const locale = localeOrNotFound((await params).locale);
  const copy = near[locale];
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, {
          page: { label: copy.title, href: href(locale, paths.near()) },
        })}
        segments={paths.near()}
      />
      <main id="main" className="frame reveal">
        <NearYou
          locale={locale}
          placesHref={href(locale, paths.explore())}
          labels={{
            ...copy,
            locating: t(locale, "locating"),
            unreachable: t(locale, "unreachable"),
            retry: t(locale, "retry"),
            showMore: t(locale, "showMore"),
            businesses: t(locale, "businesses"),
            mapData: t(locale, "mapData"),
            rows: rowLabels(locale),
          }}
        />
      </main>
      <Footer locale={locale} segments={paths.near()} />
    </>
  );
}
