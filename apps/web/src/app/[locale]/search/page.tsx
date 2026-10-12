import type { Metadata } from "next";
import Link from "next/link";
import { LOCALES } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { crumbsFor } from "@/lib/crumbs";
import { localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";

/** Plan 3 replaces this page with smart search. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  return {
    ...pageMetadata({
      locale,
      segments: paths.search(),
      title: t(locale, "search"),
      description: t(locale, "searchSoon"),
    }),
    robots: { index: false },
  };
}

export default async function SearchPage({ params }: Props) {
  const locale = localeOrNotFound((await params).locale);
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, {
          page: { label: t(locale, "search"), href: href(locale, paths.search()) },
        })}
        segments={paths.search()}
      />
      <main id="main" className="frame reveal">
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {t(locale, "search")}
        </h1>
        <p className="lede">{t(locale, "searchSoon")}</p>
        <p>
          <Link className="button-link" href={`${href(locale)}#places`}>
            {t(locale, "places")}
          </Link>
        </p>
      </main>
    </>
  );
}
