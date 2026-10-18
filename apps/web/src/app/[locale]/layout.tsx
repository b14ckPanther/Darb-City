import type { Metadata, Viewport } from "next";
import { Cairo, Heebo, Ubuntu } from "next/font/google";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import type { Locale } from "@darb/core";
import { dir, t } from "@darb/i18n";
import { isLocale } from "@/lib/locale";
import { fontStack } from "@/lib/font-stack";
import { siteUrl } from "@/lib/site";
import { tokensCss } from "@/lib/tokens-css";
import { DoorDefs } from "@/components/Door";
import { Header } from "@/components/Header";
import { NearMe } from "@/components/NearMe";
import { href, paths } from "@/lib/routes";
import { appMetadata, themeColors } from "@/lib/pwa";
import { StageMount } from "@/components/StageMount";
import { stageBootScript } from "@/lib/stage-boot";
import { themeBootScript } from "@/lib/theme";
import { installBootScript } from "@/lib/install";
import { TILES_URL } from "@/stage/vendor";
import type { StageLabels } from "@/stage/types";
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

const bodyFont = fontStack(ubuntu, heebo, cairo);

/** Day first; the device's dark scheme (or the visitor's pick) shows the night theme. */
export const viewport: Viewport = {
  themeColor: themeColors,
  colorScheme: "light dark",
  // The page reaches under the home indicator (and the notch, on its side); the header, the frame
  // and the docked search bar pad themselves by the safe-area insets.
  viewportFit: "cover",
};

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
    description: t(l, "tagline"),
    ...appMetadata(l),
  };
}

const stageLabels = (locale: Locale): StageLabels => ({
  map: t(locale, "mapLabel"),
  plaza: t(locale, "plazaLabel"),
  showMap: t(locale, "showMap"),
  showList: t(locale, "showList"),
  mapData: t(locale, "mapData"),
  businessCount: t(locale, "businessCount"),
  backToList: t(locale, "backToList"),
  pinsOf: t(locale, "pinsOf"),
  openBusiness: t(locale, "openBusiness"),
  close: t(locale, "close"),
  openNow: t(locale, "openNow"),
  closed: t(locale, "closed"),
  byAppointment: t(locale, "byAppointment"),
  distanceKm: t(locale, "distanceKm"),
  distanceM: t(locale, "distanceM"),
  loadingPins: t(locale, "loadingPins"),
});

export default async function RootLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // No tiles (a production build without a tiles URL): no map, the list is the whole city.
  const stage = TILES_URL !== null;
  return (
    <html
      lang={locale}
      dir={dir(locale)}
      className={[ubuntu.variable, heebo.variable, cairo.variable].join(" ")}
      style={{ "--font-body": bodyFont } as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <style id="darb-tokens" dangerouslySetInnerHTML={{ __html: tokensCss() }} />
        <script id="darb-theme-boot" dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
        <script id="darb-install-boot" dangerouslySetInnerHTML={{ __html: installBootScript() }} />
        {stage ? (
          <script id="darb-stage-boot" dangerouslySetInnerHTML={{ __html: stageBootScript() }} />
        ) : null}
      </head>
      <body>
        <DoorDefs />
        <a className="skip-link" href="#main">
          {t(locale, "skipToContent")}
        </a>
        <Header
          locale={locale}
          nearMe={
            <NearMe
              locale={locale}
              homeHref={href(locale)}
              nearHref={href(locale, paths.near())}
              labels={{
                nearMe: t(locale, "nearMe"),
                locating: t(locale, "locating"),
                denied: t(locale, "locationDenied"),
              }}
            />
          }
        />
        <div className="city" data-city="">
          {children}
        </div>
        {stage ? <StageMount locale={locale} labels={stageLabels(locale)} /> : null}
      </body>
    </html>
  );
}
