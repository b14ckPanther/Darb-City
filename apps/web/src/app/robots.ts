import type { MetadataRoute } from "next";
import { LOCALES } from "@darb/core";
import { indexable, siteUrl } from "@/lib/site";

/** Production opens the city to crawlers; every other deployment is closed (Task 22). */
export default function robots(): MetadataRoute.Robots {
  if (!indexable()) return { rules: [{ userAgent: "*", disallow: "/" }] };
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
