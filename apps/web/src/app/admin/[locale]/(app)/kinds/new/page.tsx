import { notFound } from "next/navigation";
import type { AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { KindForm } from "@/admin/KindForm";
import { one, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { PageHead } from "@/admin/ui";
import { isLocale } from "@/lib/locale";

/** New kinds start hidden (the API sets it; the form has no status): review, then make it active. */
export default async function NewKind({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const api = await adminApi();
  const [sectors, kinds] = await Promise.all([
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
    api.kinds.list({ query: {} }).then((r) => okOr<AdminKindDto[]>(r, locale)),
  ]);
  return (
    <>
      <PageHead
        title={at(locale, "newKind")}
        sub={at(locale, "kindsHiddenHint")}
        back={{ href: adminHref(locale, "/kinds"), label: at(locale, "navKinds") }}
      />
      <KindForm
        locale={locale}
        sectors={sectors}
        kinds={kinds}
        initialName={one((await searchParams).name)}
      />
    </>
  );
}
