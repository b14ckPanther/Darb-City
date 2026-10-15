import { notFound } from "next/navigation";
import { at } from "@/admin/copy";
import { PlanForm } from "@/admin/PlanForm";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function NewPlan({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      <h1 className={styles.h1}>{at(locale, "newPlan")}</h1>
      <PlanForm locale={locale} />
    </>
  );
}
