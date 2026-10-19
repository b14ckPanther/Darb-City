import { LOCALES } from "@darb/core";
import { helperManifest } from "@/helpers/manifest";
import { isLocale } from "@/lib/locale";

/** The helper app's manifest per locale (/api/helpers/manifest/he): its own name, scope and icon. */
export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(helperManifest(locale)), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
      "x-robots-tag": "noindex",
    },
  });
}

export const dynamic = "force-static";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}
