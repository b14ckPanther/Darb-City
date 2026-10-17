import type { Metadata } from "next";
import { t } from "@darb/i18n";
import { rowLabels } from "@/components/BusinessList";
import { CityBar } from "@/components/CityBar";
import { Footer } from "@/components/Footer";
import { NearYou } from "@/components/NearYou";
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
      title: t(locale, "nearYou"),
      description: t(locale, "nearYouLead"),
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
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, {
          page: { label: t(locale, "nearYou"), href: href(locale, paths.near()) },
        })}
        segments={paths.near()}
      />
      <main id="main" className="frame reveal">
        <NearYou
          locale={locale}
          placesHref={href(locale, paths.explore())}
          labels={{
            nearYou: t(locale, "nearYou"),
            nearYouAt: t(locale, "nearYouAt"),
            lead: t(locale, "nearYouLead"),
            ask: t(locale, "nearYouAsk"),
            useMyLocation: t(locale, "useMyLocation"),
            locating: t(locale, "locating"),
            denied: t(locale, "nearYouDenied"),
            browsePlaces: t(locale, "browsePlaces"),
            empty: t(locale, "nearYouEmpty"),
            unreachable: t(locale, "unreachable"),
            retry: t(locale, "retry"),
            showMore: t(locale, "showMore"),
            businesses: t(locale, "businesses"),
            hereMarker: t(locale, "hereMarker"),
            map: t(locale, "nearYouMap"),
            mapData: t(locale, "mapData"),
            rows: rowLabels(locale),
          }}
        />
      </main>
      <Footer locale={locale} segments={paths.near()} />
    </>
  );
}
