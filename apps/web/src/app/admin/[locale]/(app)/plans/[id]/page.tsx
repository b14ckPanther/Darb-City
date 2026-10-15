import { notFound } from "next/navigation";
import type { AdminPlanDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { EntityMeta } from "@/admin/EntityMeta";
import { PlanForm } from "@/admin/PlanForm";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function EditPlan({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const p = okOr<AdminPlanDto>(await (await adminApi()).plans.get({ params: { id } }), locale);
  return (
    <>
      <h1 className={styles.h1}>{pickText(p.name, locale)}</h1>
      <p className={styles.hint} dir="ltr">
        {p.slug}
      </p>
      <PlanForm locale={locale} plan={p} />
      <EntityMeta
        locale={locale}
        entity="plan"
        id={p.id}
        editedAt={p.editedAt}
        seedSource={p.seedSource}
      />
    </>
  );
}
