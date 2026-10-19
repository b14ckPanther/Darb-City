import { at } from "@/admin/copy";
import { Section } from "@/admin/editor-parts";
import { adminHref } from "@/admin/routes";
import { PageHead, Status } from "@/admin/ui";
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
      <PageHead
        title={<bdi>{pickText(p.name, locale)}</bdi>}
        back={{ href: adminHref(locale, "/plans"), label: at(locale, "navPlans") }}
      >
        <div className={styles.statusLine}>
          <Status locale={locale} status={p.status} />
        </div>
      </PageHead>
      <PlanForm
        locale={locale}
        plan={p}
        after={
          <Section id="advanced" title={at(locale, "secAdvanced")}>
            <EntityMeta
              locale={locale}
              entity="plan"
              id={p.id}
              editedAt={p.editedAt}
              seedSource={p.seedSource}
            />
          </Section>
        }
      />
    </>
  );
}
