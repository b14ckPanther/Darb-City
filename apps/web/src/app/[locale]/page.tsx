import { notFound } from "next/navigation";
import { t } from "@darb/i18n";
import { isLocale } from "@/lib/locale";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main id="main" className="frame">
      <h1 className="page-title">{t(locale, "appName")}</h1>
    </main>
  );
}
