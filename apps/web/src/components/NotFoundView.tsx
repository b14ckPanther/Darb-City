"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FALLBACK_TEXT } from "@/content/fallback";
import { isLocale } from "@/lib/locale";
import { href } from "@/lib/routes";
import { ClosestMatch } from "./ClosestMatch";

/** Rendered inside the city frame (the [locale] layout); the locale comes from the route. */
export function NotFoundView() {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale && isLocale(params.locale) ? params.locale : "he";
  return (
    <main id="main" className="frame reveal" data-not-found="">
      <h1 id="main-heading" tabIndex={-1} className="page-title">
        {FALLBACK_TEXT[locale].notFoundTitle}
      </h1>
      <p className="lede">{FALLBACK_TEXT[locale].notFoundBody}</p>
      <ClosestMatch template={FALLBACK_TEXT[locale].didYouMean} />
      <p>
        <Link href={href(locale)} className="button-link" data-back-home="">
          {FALLBACK_TEXT[locale].backToCity}
        </Link>
      </p>
    </main>
  );
}
