import { notFound } from "next/navigation";
import type { AdminKindDto } from "@darb/contracts";
import { adminApi, okOr } from "@/admin/api";
import { BusinessForm } from "@/admin/BusinessForm";
import { at } from "@/admin/copy";
import { getJoinStatus } from "@/lib/api";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function NewBusiness({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const kinds = okOr<AdminKindDto[]>(
    await (await adminApi()).kinds.list({ query: { status: "active" } }),
    locale,
  );
  return (
    <>
      <h1 className={styles.h1}>{at(locale, "newBusiness")}</h1>
      <BusinessForm locale={locale} kinds={kinds} uploads={(await getJoinStatus()).uploads} />
    </>
  );
}
