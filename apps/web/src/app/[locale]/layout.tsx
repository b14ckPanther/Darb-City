import type { Metadata, Viewport } from "next";
import { Cairo, Heebo, Ubuntu } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { dir, t } from "@darb/i18n";
import { colors } from "@darb/tokens";
import { isLocale } from "@/lib/locale";
import { siteUrl } from "@/lib/site";
import { tokensCss } from "@/lib/tokens-css";
import { DoorDefs } from "@/components/Door";
import { Header } from "@/components/Header";
import "../globals.css";

// Each family carries only its own script, so a page downloads what it renders.
const ubuntu = Ubuntu({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-latin",
});
const heebo = Heebo({ subsets: ["hebrew"], display: "swap", variable: "--font-hebrew" });
const cairo = Cairo({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-arabic",
  preload: false,
});

export const viewport: Viewport = { themeColor: colors.night, colorScheme: "dark" };

/** Every page renders on first request and is then cached (ISR); the build never calls the API. */
export function generateStaticParams() {
  return [];
}

type LayoutProps = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : "he";
  return {
    metadataBase: new URL(siteUrl()),
    applicationName: t(l, "appName"),
    description: t(l, "tagline"),
    icons: {
      icon: [
        { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/brand/apple-touch-icon.png",
    },
  };
}

export default async function RootLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html
      lang={locale}
      dir={dir(locale)}
      className={[ubuntu.variable, heebo.variable, cairo.variable].join(" ")}
    >
      <head>
        <style id="darb-tokens" dangerouslySetInnerHTML={{ __html: tokensCss() }} />
      </head>
      <body>
        <DoorDefs />
        <a className="skip-link" href="#main">
          {t(locale, "skipToContent")}
        </a>
        <Header locale={locale} />
        {children}
      </body>
    </html>
  );
}
