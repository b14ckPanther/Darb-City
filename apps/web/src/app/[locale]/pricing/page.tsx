import type { Metadata } from "next";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { PricingView } from "@/components/PricingView";
import { getPricing } from "@/lib/api";
import { crumbsFor } from "@/lib/crumbs";
import { localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { pricingText } from "@/lib/pricing";
import { href, paths } from "@/lib/routes";
import { metadataOrUnavailable, orUnavailable } from "@/lib/unavailable";

/** Admin edits revalidate the "pricing" tag; the day is only a backstop. */
export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string }> };

export const generateMetadata = metadataOrUnavailable(async function metadata({
  params,
}: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  const { texts } = await getPricing();
  return pageMetadata({
    locale,
    segments: paths.pricing(),
    title: pricingText(texts, "pricing.title", locale) || t(locale, "pricing"),
    description: pricingText(texts, "pricing.intro", locale) || t(locale, "tagline"),
  });
});

export default orUnavailable(async function PricingPage({ params }: Props) {
  const locale = localeOrNotFound((await params).locale);
  const pricing = await getPricing();
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, {
          page: { label: t(locale, "pricing"), href: href(locale, paths.pricing()) },
        })}
        segments={paths.pricing()}
      />
      <main id="main" className="frame reveal">
        <PricingView locale={locale} pricing={pricing} />
      </main>
    </>
  );
});
