import type { Metadata } from "next";
import { pickText, type Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { ContactForm } from "@/components/ContactForm";
import { Footer } from "@/components/Footer";
import { contact } from "@/content/contact";
import { SOCIAL } from "@/content/footer";
import { getPricing } from "@/lib/api";
import { initialTopic } from "@/lib/contact-form";
import { crumbsFor } from "@/lib/crumbs";
import { localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import styles from "@/components/Contact.module.css";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ plan?: string | string[]; topic?: string | string[] }>;
};

/** ?plan= and ?topic= open the form on the right subject, so the page renders on request. */
export const revalidate = 0;

const first = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw);

/** The plan's name for the "About the plan" line; none when the API is down or it is not live. */
async function planName(slug: string | null, locale: Locale): Promise<string | null> {
  if (!slug) return null;
  try {
    const plan = (await getPricing()).plans.find((p) => p.slug === slug);
    return plan ? pickText(plan.name, locale) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  return pageMetadata({
    locale,
    segments: paths.contact(),
    title: t(locale, "contactUs"),
    description: contact[locale].lead,
  });
}

/** Every "contact us" on Darb leads here: the message reaches the admin inbox and the founder. */
export default async function ContactPage({ params, searchParams }: Props) {
  const locale = localeOrNotFound((await params).locale);
  const query = await searchParams;
  const copy = contact[locale];
  const start = initialTopic({ plan: first(query.plan), topic: first(query.topic) });
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, {
          page: { label: t(locale, "contactUs"), href: href(locale, paths.contact()) },
        })}
        segments={paths.contact()}
      />
      <main id="main" className="frame reveal">
        <header className={styles.hero}>
          <p className={styles.eyebrow}>{t(locale, "contactUs")}</p>
          <h1 id="main-heading" tabIndex={-1} className={`page-title ${styles.title}`}>
            {copy.title}
          </h1>
          <p className={`lede ${styles.intro}`}>{copy.lead}</p>
        </header>
        <div className={styles.layout}>
          <section className={styles.card}>
            <ContactForm
              locale={locale}
              copy={copy.form}
              initialTopic={start.topic}
              plan={start.plan}
              planName={await planName(start.plan, locale)}
            />
          </section>
          <aside className={styles.aside} aria-label="Instagram">
            <p>{copy.instagramLine}</p>
            <a
              className={styles.instagram}
              href={SOCIAL.darbInstagram.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span dir="ltr">{SOCIAL.darbInstagram.handle}</span>
            </a>
          </aside>
        </div>
      </main>
      <Footer locale={locale} segments={paths.contact()} />
    </>
  );
}
