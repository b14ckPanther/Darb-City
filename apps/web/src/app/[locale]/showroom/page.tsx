import type { Metadata } from "next";
import Link from "next/link";
import { LOCALES } from "@darb/core";
import { Footer } from "@/components/Footer";
import { Showroom } from "@/components/showroom/Showroom";
import { showroom } from "@/content/showroom";
import { localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import landing from "@/components/landing/Landing.module.css";
import styles from "@/components/showroom/ShowroomPage.module.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  const copy = showroom[locale];
  return pageMetadata({
    locale,
    segments: paths.showroom(),
    title: copy.title,
    description: copy.description,
  });
}

/** Darb's client builds, running live in a laptop, a tablet and a phone. */
export default async function ShowroomPage({ params }: Props) {
  const locale = localeOrNotFound((await params).locale);
  const copy = showroom[locale];
  return (
    <>
      <main id="main" className={`frame ${styles.page}`}>
        <header className={styles.head}>
          <span className={landing.eyebrow}>{copy.eyebrow}</span>
          <h1 id="main-heading" tabIndex={-1} className={styles.title}>
            {copy.heading}
          </h1>
          <p className={styles.lead}>{copy.lead}</p>
        </header>
        <Showroom
          clients={copy.clients}
          labels={{
            live: copy.live,
            open: copy.open,
            tryLive: copy.tryLive,
            close: copy.close,
            loading: copy.loading,
            device: copy.device,
            frameTitle: copy.frameTitle,
            devices: copy.devices,
            shotAlt: copy.shotAlt,
          }}
        />
        <section className={styles.cta} aria-labelledby="showroom-cta">
          <h2 id="showroom-cta" className={landing.sectionTitle}>
            {copy.cta.title}
          </h2>
          <p>{copy.cta.body}</p>
          <div className={landing.actions}>
            <Link href={href(locale, paths.contact())} className={landing.primary}>
              {copy.cta.talk}
            </Link>
            <Link href={href(locale, paths.pricing())} className={landing.secondary}>
              {copy.cta.pricing}
            </Link>
          </div>
        </section>
      </main>
      <Footer locale={locale} segments={paths.showroom()} />
    </>
  );
}
