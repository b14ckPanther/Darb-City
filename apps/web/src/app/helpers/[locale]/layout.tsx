import { ClerkProvider } from "@clerk/nextjs";
import { arSA, enUS, heIL } from "@clerk/localizations";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Cairo, Heebo, Ubuntu } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import type { Locale } from "@darb/core";
import { dir } from "@darb/i18n";
import { themeColor } from "@darb/tokens";
import { adminAuthMode } from "@/admin/mode";
import { ht } from "@/helpers/copy";
import { HELPER_ICONS } from "@/helpers/manifest";
import { HelperWorker } from "@/helpers/HelperWorker";
import { helperHref, helperManifestHref } from "@/helpers/routes";
import { fontStack } from "@/lib/font-stack";
import { installBootScript } from "@/lib/install";
import { isLocale } from "@/lib/locale";
import { themeBootScript } from "@/lib/theme";
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
const bodyFont = fontStack(ubuntu, heebo, cairo);
const CLERK_LOCALES = { he: heIL, ar: arSA, en: enUS } as const;

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: themeColor.day },
    { media: "(prefers-color-scheme: dark)", color: themeColor.night },
  ],
  colorScheme: "light dark",
  viewportFit: "cover",
};

/** The helper app's own name, manifest and icons, so it installs apart from the public site. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "he";
  const appName = ht(locale, "appName");
  const tab = (theme: "light" | "dark") => ({
    url: `${HELPER_ICONS}/helper-favicon-${theme}-32.png`,
    sizes: "32x32",
    type: "image/png",
    media: `(prefers-color-scheme: ${theme})`,
  });
  return {
    title: ht(locale, "title"),
    robots: { index: false, follow: false },
    applicationName: appName,
    manifest: helperManifestHref(locale),
    appleWebApp: { capable: true, title: appName, statusBarStyle: "default" },
    formatDetection: { telephone: false },
    icons: {
      icon: [tab("light"), tab("dark")],
      apple: {
        url: `${HELPER_ICONS}/helper-apple-touch-icon-light.png`,
        sizes: "180x180",
        type: "image/png",
      },
    },
  };
}

/** /helpers: its own root (Clerk runs here and in /admin only; public pages never load it). */
export default async function HelperRootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "he";
  // The proxy's per-request nonce: /helpers' CSP allows no other inline script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const html = (
    <html
      lang={locale}
      dir={dir(locale)}
      className={[ubuntu.variable, heebo.variable, cairo.variable].join(" ")}
      style={{ "--font-body": bodyFont } as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: tokensCss() }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: installBootScript() }} />
      </head>
      <body className={styles.body}>
        {children}
        <HelperWorker scope={helperHref(locale)} />
      </body>
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
