import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/admin/AdminShell";
import { adminSession } from "@/admin/api";
import { at } from "@/admin/copy";
import { adminAuthMode } from "@/admin/mode";
import { adminHref, adminRoute } from "@/admin/routes";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

/** Every admin screen: signed in with Clerk, and an admin by the API's say (User.isAdmin). */
export default async function AdminAppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await adminSession();
  if (session.status === "signed-out") redirect(adminHref(locale, "/sign-in"));
  if (session.status !== "ok")
    return (
      <main className={styles.center}>
        <p className={styles.notice}>
          {at(locale, session.status === "forbidden" ? "notAdmin" : "notConfigured")}
        </p>
      </main>
    );
  // The proxy rewrote /ar/admin/x to /admin/ar/x; the original path is in next-url when present.
  const original = (await headers()).get("x-darb-admin-path") ?? "";
  return (
    <AdminShell locale={locale} path={adminRoute(original)?.rest ?? ""} mode={adminAuthMode()}>
      {children}
    </AdminShell>
  );
}
