import { LOCALES } from "@darb/core";
import { isLocale } from "@/lib/locale";
import { manifest } from "@/lib/pwa";

/** One web app manifest per locale (/he, /ar, /en): its own name, lang, dir and start page. */
export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(manifest(locale)), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}

export const dynamic = "force-static";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}
