import { notFound } from "next/navigation";
import { at } from "@/admin/copy";
import { PlaceForm } from "@/admin/PlaceForm";
import { adminHref } from "@/admin/routes";
import { PageHead } from "@/admin/ui";
import { isLocale } from "@/lib/locale";

export default async function NewPlace({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      <PageHead
        title={at(locale, "newPlace")}
        back={{ href: adminHref(locale, "/places"), label: at(locale, "navPlaces") }}
      />
      <PlaceForm locale={locale} />
    </>
  );
}
