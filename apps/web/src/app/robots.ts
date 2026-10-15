import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { LOCALES } from "@darb/core";
import { indexable, siteUrl } from "@/lib/site";

/** Read at request time, so a preview never serves the production rules a build baked in. */
export const dynamic = "force-dynamic";

/** Production opens the city to crawlers; every other deployment is closed (Task 22). */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!indexable(process.env, (await headers()).get("host")))
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  const site = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/ar/admin",
          "/en/admin",
          "/api/",
          "/search",
          "/ar/search",
          "/en/search",
        ],
      },
    ],
    sitemap: LOCALES.map((_, i) => `${site}/sitemap/${i}.xml`),
  };
}
