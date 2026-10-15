import type { PlanDto, PricingDto } from "@darb/contracts";
import { pickText, type Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { CONTACT } from "@/content/for-business";
import {
  faqEntries,
  formatShekels,
  priceLabel,
  pricingText,
  shekelParts,
  textLines,
} from "@/lib/pricing";
import styles from "./Pricing.module.css";

/** Links that leave Darb open in a new tab; mail and paths on this site stay where they are. */
const external = (href: string) =>
  /^https?:\/\//i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};

function Check() {
  return (
    <svg className={styles.check} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="9" />
      <path d="M6 10.4 8.7 13 14 7.4" />
    </svg>
  );
}

function Price({ plan, pricing, locale }: { plan: PlanDto; pricing: PricingDto; locale: Locale }) {
  const label = priceLabel(plan, pricing.texts, locale);
  const note = pickText(plan.priceNote, locale);
  const setup =
    plan.setup !== null
      ? pricingText(pricing.texts, "pricing.setup", locale).replace(
          "{amount}",
          formatShekels(plan.setup, locale),
        )
      : "";
  return (
    <div className={styles.price}>
      <p className={styles.amount}>
        {label.kind === "amount" ? (
          <bdi>
            {shekelParts(label.value, locale).map((p, i) =>
              p.currency ? (
                <span key={i} className={styles.currency}>
                  {p.text}
                </span>
              ) : (
                p.text
              ),
            )}
          </bdi>
        ) : (
          label.text
        )}
      </p>
      {note ? <p className={styles.note}>{note}</p> : null}
      {setup ? <p className={styles.note}>{setup}</p> : null}
    </div>
  );
}

function PlanCard({
  plan,
  pricing,
  locale,
}: {
  plan: PlanDto;
  pricing: PricingDto;
  locale: Locale;
}) {
  const badge = plan.highlighted ? pricingText(pricing.texts, "pricing.badge", locale) : "";
  const tagline = pickText(plan.tagline, locale);
  const finePrint = pickText(plan.finePrint, locale);
  const features = plan.features[locale].length > 0 ? plan.features[locale] : plan.features.en;
  return (
    <li className={plan.highlighted ? `${styles.card} ${styles.featured}` : styles.card}>
      {plan.highlighted ? <span className={styles.edge} aria-hidden="true" /> : null}
      {badge ? <p className={styles.badge}>{badge}</p> : null}
      <h2 className={styles.name}>{pickText(plan.name, locale)}</h2>
      {tagline ? <p className={styles.tagline}>{tagline}</p> : null}
      <Price plan={plan} pricing={pricing} locale={locale} />
      <a
        href={plan.ctaHref}
        className={plan.highlighted ? `${styles.cta} ${styles.ctaPrimary}` : styles.cta}
        {...external(plan.ctaHref)}
      >
        {pickText(plan.ctaLabel, locale)}
      </a>
      {features.length > 0 ? (
        <ul className={styles.features} aria-label={t(locale, "included")}>
          {features.map((f) => (
            <li key={f}>
              <Check />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {finePrint ? <p className={styles.finePrint}>{finePrint}</p> : null}
    </li>
  );
}

/** The pricing page's body: every word comes from the admin (plans and "pricing." texts). */
export function PricingView({ locale, pricing }: { locale: Locale; pricing: PricingDto }) {
  const text = (key: Parameters<typeof pricingText>[1]) => pricingText(pricing.texts, key, locale);
  const eyebrow = text("pricing.eyebrow");
  const intro = text("pricing.intro");
  const terms = textLines(text("pricing.terms"));
  const faq = faqEntries(text("pricing.faq"));
  const contactTitle = text("pricing.contactTitle");
  return (
    <>
      <header className={styles.hero}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 id="main-heading" tabIndex={-1} className={`page-title ${styles.title}`}>
          {text("pricing.title") || t(locale, "pricing")}
        </h1>
        {intro ? <p className={`lede ${styles.intro}`}>{intro}</p> : null}
      </header>
      {pricing.plans.length > 0 ? (
        <ul className={styles.plans}>
          {pricing.plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} pricing={pricing} locale={locale} />
          ))}
        </ul>
      ) : (
        <p className="quiet">{t(locale, "pricingSoon")}</p>
      )}
      <div className={styles.more}>
        {terms.length > 0 ? (
          <section aria-labelledby="terms-title" className={styles.terms}>
            <h2 id="terms-title" className={styles.sectionTitle}>
              {text("pricing.termsTitle")}
            </h2>
            <ol className={styles.termList}>
              {terms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ol>
          </section>
        ) : null}
        {faq.length > 0 ? (
          <section aria-labelledby="faq-title" className={styles.faq}>
            <h2 id="faq-title" className={styles.sectionTitle}>
              {text("pricing.faqTitle")}
            </h2>
            {faq.map((entry) => (
              <details key={entry.question} className={styles.question}>
                <summary>{entry.question}</summary>
                <p>{entry.answer}</p>
              </details>
            ))}
          </section>
        ) : null}
      </div>
      {contactTitle ? (
        <section aria-labelledby="contact-title" className={styles.contact}>
          <h2 id="contact-title" className={styles.sectionTitle}>
            {contactTitle}
          </h2>
          <p>{text("pricing.contactBody")}</p>
          <p className={styles.contactLinks}>
            <a className={`${styles.cta} ${styles.ctaPrimary}`} href={`mailto:${CONTACT.email}`}>
              <span dir="ltr">{CONTACT.email}</span>
            </a>
            <a className={styles.cta} href={CONTACT.instagram} {...external(CONTACT.instagram)}>
              <span dir="ltr">@darbco</span>
            </a>
          </p>
        </section>
      ) : null}
    </>
  );
}
