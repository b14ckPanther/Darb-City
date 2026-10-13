import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@darb/i18n";
import { rowLabels } from "@/components/BusinessList";
import { CityBar } from "@/components/CityBar";
import { SearchFallback } from "@/components/SearchFallback";
import { SearchQuery } from "@/components/SearchQuery";
import { SearchResults } from "@/components/SearchResults";
import { StageData } from "@/components/StageData";
import { searchLabels } from "@/components/SearchBar";
import { clientIpFrom } from "@/lib/client-ip";
import { crumbsFor } from "@/lib/crumbs";
import { localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import { runSearch } from "@/lib/search-run";
import { intentFromUrl } from "@/lib/search-view";
import { COUNTRY_STAGE } from "@/lib/stage-data";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string | string[];
    chips?: string | string[];
    text?: string | string[];
  }>;
};

/**
 * Every search renders on request (the [locale] layout's empty static params would otherwise make
 * /search an ISR page, where headers() fails). 0, not force-dynamic: the taxonomy and place reads
 * keep their own revalidate instead of turning no-store on every search.
 */
export const revalidate = 0;

const first = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw);
const queryOf = (raw: string | string[] | undefined) =>
  (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 200) ?? "";

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  const q = queryOf((await searchParams).q);
  return {
    ...pageMetadata({
      locale,
      segments: paths.search(),
      title: q ? t(locale, "searchResultsTitle", { q }) : t(locale, "search"),
      description: t(locale, "searchHint"),
    }),
    robots: { index: false },
  };
}

/** Decision 6: results on the server from ?q= (no JavaScript needed), stage kept (M7). */
export default async function SearchPage({ params, searchParams }: Props) {
  const locale = localeOrNotFound((await params).locale);
  const query = await searchParams;
  const q = queryOf(query.q);
  const edited = intentFromUrl(first(query.chips), first(query.text));
  const crumbs = crumbsFor(locale, {
    page: { label: t(locale, "search"), href: href(locale, paths.search()) },
  });
  let body: ReactNode;
  if (!q) {
    body = (
      <>
        <StageData level={COUNTRY_STAGE} />
        <p className="lede">{t(locale, "searchHint")}</p>
        <p>
          <Link className="button-link" href={`${href(locale)}#places`}>
            {t(locale, "places")}
          </Link>
        </p>
      </>
    );
  } else {
    const view = await runSearch({ locale, q, edited, ip: clientIpFrom(await headers()) });
    body = view ? (
      <SearchResults
        // A new query (the header box navigates in place) starts a new results list.
        key={`${q}\n${first(query.chips) ?? ""}`}
        locale={locale}
        initial={view}
        labels={{
          removeChip: t(locale, "removeChip"),
          resultCount: t(locale, "resultCount"),
          noResults: t(locale, "noResults"),
          blocked: t(locale, "blocked"),
          places: t(locale, "places"),
          placesHref: `${href(locale)}#places`,
          nearMe: t(locale, "nearMe"),
          locating: t(locale, "locating"),
          locationDenied: t(locale, "locationDenied"),
          unreachable: t(locale, "unreachable"),
          nearestPlaces: t(locale, "nearestPlaces"),
          nothingOpen: t(locale, "nothingOpen"),
          rows: rowLabels(locale),
        }}
      />
    ) : (
      <>
        {/* Lane 1 links have no pins: the map shows the country. */}
        <StageData level={COUNTRY_STAGE} />
        <SearchFallback
          locale={locale}
          q={q}
          labels={{
            ...searchLabels(locale),
            notice: t(locale, "searchUnavailable"),
            retry: t(locale, "retry"),
          }}
        />
      </>
    );
  }
  return (
    <>
      <CityBar locale={locale} crumbs={crumbs} segments={paths.search()} />
      <SearchQuery q={q} />
      <main id="main" className="frame">
        <div id="city-list" className="reveal">
          <h1 id="main-heading" tabIndex={-1} className="page-title">
            {q ? t(locale, "searchResultsTitle", { q }) : t(locale, "search")}
          </h1>
          {body}
        </div>
      </main>
    </>
  );
}
