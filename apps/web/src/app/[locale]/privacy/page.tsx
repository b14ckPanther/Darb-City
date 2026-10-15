import type { Metadata } from "next";
import { LOCALES } from "@darb/core";
import { CityBar } from "@/components/CityBar";
import { Footer } from "@/components/Footer";
import { LegalDocument } from "@/components/LegalDocument";
import { legal } from "@/content/legal";
import { crumbsFor } from "@/lib/crumbs";
import { localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  const copy = legal.privacy[locale];
  return pageMetadata({
    locale,
    segments: paths.privacy(),
    title: copy.title,
    description: copy.lead,
  });
}

export default async function PrivacyPage({ params }: Props) {
  const locale = localeOrNotFound((await params).locale);
  const copy = legal.privacy[locale];
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, {
          page: { label: copy.title, href: href(locale, paths.privacy()) },
        })}
        segments={paths.privacy()}
      />
      <LegalDocument locale={locale} doc={copy} />
      <Footer locale={locale} segments={paths.privacy()} />
    </>
  );
}
