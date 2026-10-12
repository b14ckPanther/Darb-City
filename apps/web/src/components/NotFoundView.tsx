"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { t } from "@darb/i18n";
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
        {t(locale, "notFoundTitle")}
      </h1>
      <p className="lede">{t(locale, "notFoundBody")}</p>
      <ClosestMatch template={t(locale, "didYouMean", { name: "{name}" })} />
      <p>
        <Link href={href(locale)} className="button-link" data-back-home="">
          {t(locale, "backToCity")}
        </Link>
      </p>
    </main>
  );
}
