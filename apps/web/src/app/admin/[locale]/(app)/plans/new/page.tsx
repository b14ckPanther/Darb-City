import { adminHref } from "@/admin/routes";
import { PageHead } from "@/admin/ui";
import { notFound } from "next/navigation";
import { at } from "@/admin/copy";
import { PlanForm } from "@/admin/PlanForm";
import { isLocale } from "@/lib/locale";

export default async function NewPlan({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      <PageHead
        title={at(locale, "newPlan")}
        back={{ href: adminHref(locale, "/plans"), label: at(locale, "navPlans") }}
      />
      <PlanForm locale={locale} />
    </>
  );
}
