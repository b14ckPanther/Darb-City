import { notFound } from "next/navigation";
import { at } from "@/admin/copy";
import { adminHref } from "@/admin/routes";
import { SectorForm } from "@/admin/SectorForm";
import { PageHead } from "@/admin/ui";
import { isLocale } from "@/lib/locale";

export default async function NewSector({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      <PageHead
        title={at(locale, "newSector")}
        back={{ href: adminHref(locale, "/sectors"), label: at(locale, "navSectors") }}
      />
      <SectorForm locale={locale} />
    </>
  );
}
