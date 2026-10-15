import type { Metadata } from "next";
import { Fragment } from "react";
import { LOCALES, pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";

import { CONTACT, forBusiness, LIVE_CLIENTS, type RichText } from "@/content/for-business";
import { crumbsFor } from "@/lib/crumbs";
import { localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import styles from "@/components/ForBusiness.module.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

type Props = { params: Promise<{ locale: string }> };

/** Latin runs (store names) are isolated so they keep their order inside Hebrew and Arabic. */
function Rich({ text }: { text: RichText }) {
  if (typeof text === "string") return text;
  return text.map((part, i) => (
    <Fragment key={i}>
      {typeof part === "string" ? part : <bdi dir="ltr">{part.latin}</bdi>}
    </Fragment>
  ));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  const copy = forBusiness[locale];
  return pageMetadata({
    locale,
    segments: paths.forBusiness(),
    title: copy.title,
    description: copy.lead,
  });
}

export default async function ForBusinessPage({ params }: Props) {
  const locale = localeOrNotFound((await params).locale);
  const copy = forBusiness[locale];
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, {
          page: { label: t(locale, "forBusiness"), href: href(locale, paths.forBusiness()) },
        })}
        segments={paths.forBusiness()}
      />
      <main id="main" className="frame reveal">
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {copy.title}
        </h1>
        <p className="lede">{copy.lead}</p>
        <ul className={styles.points}>
          {copy.points.map((point) => (
            <li key={point.title} className={styles.point}>
              <h2 className={styles.pointTitle}>{point.title}</h2>
              <p>
                <Rich text={point.body} />
              </p>
            </li>
          ))}
        </ul>
        <section aria-labelledby="clients-title" className={styles.section}>
          <h2 id="clients-title">{copy.clientsTitle}</h2>
          <ul className={styles.clients}>
            {LIVE_CLIENTS.map((client) => {
              const body = (
                <>
                  <span className={styles.clientName}>{pickText(client.name, locale)}</span>
                  <span className={styles.clientKind}>{pickText(client.kind, locale)}</span>
                </>
              );
              return (
                <li key={client.name.en}>
                  {client.url ? (
                    <a
                      href={client.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.client}
                    >
                      {body}
                    </a>
                  ) : (
                    // A staff-only app: named as client work, never linked.
                    <span className={styles.client}>{body}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-labelledby="contact-title" className={styles.section}>
          <h2 id="contact-title">{copy.contactTitle}</h2>
          <p>{copy.contactBody}</p>
          <p className={styles.contact}>
            <a className="button-link" href={`mailto:${CONTACT.email}`}>
              {copy.email}: <span dir="ltr">{CONTACT.email}</span>
            </a>
            <a
              className="button-link"
              href={CONTACT.instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy.instagram}
            </a>
          </p>
        </section>
      </main>
    </>
  );
}
