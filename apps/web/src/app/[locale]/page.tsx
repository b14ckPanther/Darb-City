import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Footer } from "@/components/Footer";
import { Blueprint } from "@/components/landing/Blueprint";
import { Reveal, ScrollScene } from "@/components/landing/ScrollScene";
import { landing } from "@/content/landing";
import { SOCIAL } from "@/content/footer";
import { localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import styles from "@/components/landing/Landing.module.css";

export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  const copy = landing[locale];
  return pageMetadata({ locale, segments: [], title: copy.title, description: copy.description });
}

/** The landing page: the story first, then how Darb works, search, the work, and joining. */
export default async function LandingPage({ params }: Props) {
  const locale = localeOrNotFound((await params).locale);
  const copy = landing[locale];
  const layers = copy.platform.layers;
  return (
    <div className={styles.page}>
      <main id="main">
        <section className={styles.hero} aria-labelledby="main-heading">
          <div className={styles.heroStage}>
            <div className={styles.heroGlow} aria-hidden="true" />
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>{copy.hero.eyebrow}</span>
              <h1 id="main-heading" tabIndex={-1} className={styles.heroTitle}>
                {copy.hero.title}
                <span className={styles.heroAccent}>{copy.hero.accent}</span>
              </h1>
              <p className={styles.heroLead}>{copy.hero.lead}</p>
              <div className={styles.actions}>
                <Link href={href(locale, paths.explore())} className={styles.primary}>
                  {copy.hero.explore}
                </Link>
                <Link href={href(locale, paths.showroom())} className={styles.secondary}>
                  {copy.hero.showroom}
                </Link>
              </div>
            </div>
            <div className={styles.heroVisual} aria-hidden="true">
              <div className={styles.markWrap}>
                <Blueprint className={styles.blueprint} />
                <Image
                  className={styles.mark}
                  src="/brand/darb-mark-480.webp"
                  alt=""
                  width={480}
                  height={528}
                  priority
                  unoptimized
                />
              </div>
            </div>
            <p className={styles.scrollHint} aria-hidden="true">
              {copy.hero.scroll}
            </p>
          </div>
        </section>

        <section className={`frame ${styles.story}`} aria-labelledby="story-title">
          <Reveal className={styles.storyInner}>
            <span id="story-title" className={styles.eyebrow}>
              {copy.story.eyebrow}
            </span>
            <div className={styles.storyText}>
              {copy.story.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className={styles.signature}>
              <Image src="/brand/darb-mark-96.webp" alt="" width={48} height={53} unoptimized />
              <span>
                <span className={styles.signName}>{copy.story.signature}</span>
                <span className={styles.signRole}>{copy.story.role}</span>
              </span>
            </div>
          </Reveal>
        </section>

        <ScrollScene className={styles.platform} labelledBy="platform-title">
          <div className={`frame ${styles.platformStage}`}>
            <div className={styles.platformHead}>
              <span className={styles.eyebrow} style={{ justifySelf: "center" }}>
                {copy.platform.eyebrow}
              </span>
              <h2 id="platform-title" className={styles.sectionTitle}>
                {copy.platform.title}
              </h2>
            </div>
            <div className={styles.platformBody}>
              <div className={styles.iso} aria-hidden="true">
                {layers.map((layer, i) => (
                  <span
                    key={layer.title}
                    className={styles.plate}
                    data-n={String(i + 1).padStart(2, "0")}
                    style={{ "--i": i } as CSSProperties}
                  />
                ))}
              </div>
              <ol className={styles.steps}>
                {layers.map((layer, i) => (
                  <li
                    key={layer.title}
                    className={styles.step}
                    style={{ "--i": i } as CSSProperties}
                  >
                    <span className={styles.stepIndex} aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <span className={styles.stepTitle}>{layer.title}</span>
                      <span className={styles.stepBody}>{layer.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className={styles.compare}>
              <p className={`${styles.side} ${styles.without}`}>
                <strong>{copy.platform.without.label}</strong>
                {copy.platform.without.body}
              </p>
              <p className={`${styles.side} ${styles.with}`}>
                <strong>{copy.platform.with.label}</strong>
                {copy.platform.with.body}
              </p>
            </div>
          </div>
        </ScrollScene>

        <section className={`frame ${styles.searchBand}`} aria-labelledby="search-title">
          <Reveal className={styles.searchCard}>
            <span className={styles.eyebrow}>{copy.search.eyebrow}</span>
            <h2 id="search-title" className={styles.sectionTitle}>
              {copy.search.title}
            </h2>
            <p>{copy.search.body}</p>
            <ul className={styles.examples}>
              {copy.search.examples.map((q) => (
                <li key={q}>
                  <Link
                    className={styles.example}
                    href={`${href(locale, paths.search())}?q=${encodeURIComponent(q)}`}
                  >
                    {q}
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section className={`frame ${styles.made}`} aria-labelledby="made-title">
          <div className={styles.madeHead}>
            <span className={styles.eyebrow}>{copy.made.eyebrow}</span>
            <h2 id="made-title" className={styles.sectionTitle}>
              {copy.made.title}
            </h2>
            <p>{copy.made.body}</p>
          </div>
          <ul className={styles.clients}>
            {copy.made.clients.map((c) => {
              const host = new URL(c.url).hostname;
              return (
                <Reveal as="li" key={c.url}>
                  <Link
                    className={styles.client}
                    href={`${href(locale, paths.showroom())}#${host.split(".")[0]}`}
                  >
                    <span className={styles.clientHost}>{host}</span>
                    <span className={styles.clientName}>{c.name}</span>
                    <span className={styles.clientKind}>{c.kind}</span>
                    <span className={styles.clientOpen}>{copy.made.open}</span>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        </section>

        <section className={`frame ${styles.join}`} aria-labelledby="join-title">
          <Reveal className={styles.joinCard}>
            <h2 id="join-title" className={styles.sectionTitle}>
              {copy.join.title}
            </h2>
            <p>{copy.join.body}</p>
            <div className={styles.actions}>
              <Link href={href(locale, paths.pricing())} className={styles.primary}>
                {copy.join.pricing}
              </Link>
              <a href={SOCIAL.email.href} className={styles.secondary}>
                {copy.join.talk}
              </a>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer locale={locale} />
    </div>
  );
}
