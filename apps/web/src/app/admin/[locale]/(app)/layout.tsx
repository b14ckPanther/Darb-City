import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/admin/AdminShell";
import { adminApi, adminSession } from "@/admin/api";
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
  // The Messages badge: a failed count only hides the badge, never the admin.
  const inbox = await (
    await adminApi()
  ).inquiries
    .list({ query: { status: "new", limit: 1 } })
    .catch(() => null);
  const newInquiries = inbox?.status === 200 ? inbox.body.newCount : 0;
  // The proxy rewrote /ar/admin/x to /admin/ar/x; the original path is in next-url when present.
  const original = (await headers()).get("x-darb-admin-path") ?? "";
  return (
    <AdminShell
      locale={locale}
      path={adminRoute(original)?.rest ?? ""}
      mode={adminAuthMode()}
      newInquiries={newInquiries}
    >
      {children}
    </AdminShell>
  );
}
