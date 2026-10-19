import { notFound } from "next/navigation";
import type { AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { adminApi, okOr } from "@/admin/api";
import { BusinessForm } from "@/admin/BusinessForm";
import { at } from "@/admin/copy";
import { adminHref } from "@/admin/routes";
import { PageHead } from "@/admin/ui";
import { getJoinStatus } from "@/lib/api";
import { isLocale } from "@/lib/locale";

export default async function NewBusiness({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const api = await adminApi();
  const [kinds, sectors, join] = await Promise.all([
    api.kinds.list({ query: { status: "active" } }).then((r) => okOr<AdminKindDto[]>(r, locale)),
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
    getJoinStatus(),
  ]);
  return (
    <>
      <PageHead
        title={at(locale, "newBusiness")}
        sub={at(locale, "newBusinessHint")}
        back={{ href: adminHref(locale, "/businesses"), label: at(locale, "navBusinesses") }}
      />
      <BusinessForm locale={locale} kinds={kinds} sectors={sectors} uploads={join.uploads} />
    </>
  );
}
