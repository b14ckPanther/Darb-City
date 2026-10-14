import { ClerkProvider } from "@clerk/nextjs";
import { arSA, enUS, heIL } from "@clerk/localizations";
import type { Metadata } from "next";
import { Cairo, Heebo, Ubuntu } from "next/font/google";
import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { dir } from "@darb/i18n";
import { adminAuthMode } from "@/admin/mode";
import { at } from "@/admin/copy";
import { isLocale } from "@/lib/locale";
import { tokensCss } from "@/lib/tokens-css";
import styles from "@/admin/admin.module.css";

const ubuntu = Ubuntu({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-latin",
});
const heebo = Heebo({ subsets: ["hebrew"], display: "swap", variable: "--font-hebrew" });
const cairo = Cairo({ subsets: ["arabic"], display: "swap", variable: "--font-arabic" });
const CLERK_LOCALES = { he: heIL, ar: arSA, en: enUS } as const;

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: at(isLocale(locale) ? locale : "he", "title"),
    robots: { index: false, follow: false },
  };
}

export default async function AdminRootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "he";
  const html = (
    <html
      lang={locale}
      dir={dir(locale)}
      className={[ubuntu.variable, heebo.variable, cairo.variable].join(" ")}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: tokensCss() }} />
      </head>
      <body className={styles.body}>{children}</body>
    </html>
  );
  return adminAuthMode() === "clerk" ? (
    <ClerkProvider dynamic localization={CLERK_LOCALES[locale]}>
      {html}
    </ClerkProvider>
  ) : (
    html
  );
}
