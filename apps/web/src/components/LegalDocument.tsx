import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { Locale } from "@darb/core";
import { dir, t } from "@darb/i18n";
import { LEGAL_UPDATED, legalChrome, type LegalBlock, type LegalDoc } from "@/content/legal";
import { INTL_TAG } from "@/lib/locale";
import { href, paths } from "@/lib/routes";
import styles from "./LegalDocument.module.css";

/** A Latin run: a name, an address or a code, with the words, digits and spaces inside it. */
const LATIN = /\/?[A-Za-z][\w.@/+-]*(?: [A-Za-z0-9][\w.@/+-]*)*/g;
const EMAILS = /[^\s@()]+@[^\s@()]+\.[a-z]{2,}/g;
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/;

/**
 * Plain copy. The law asks for a written address, so it stays in the text, but as text: people
 * write through the contact page (linked below), never a mail pop-up. In Hebrew and Arabic every
 * Latin run is isolated (`<bdi dir="ltr">`), so "founder@darb.co.il" or "Voyage AI" keeps its
 * order inside RTL text; in English an address is kept left to right on its own.
 */
export function Prose({ text, rtl }: { text: string; rtl: boolean }): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(rtl ? LATIN : EMAILS)) {
    // A sentence's closing full stop belongs to the sentence, not to the address before it.
    const run = match[0].replace(/[.-]+$/, "");
    const start = match.index;
    if (start > last) parts.push(text.slice(last, start));
    const inner = rtl ? <bdi dir="ltr">{run}</bdi> : run;
    parts.push(EMAIL.test(run) && !rtl ? <span dir="ltr">{run}</span> : inner);
    last = start + run.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((part, i) => <Fragment key={i}>{part}</Fragment>);
}

function Block({ block, rtl }: { block: LegalBlock; rtl: boolean }) {
  if (typeof block === "string")
    return (
      <p>
        <Prose text={block} rtl={rtl} />
      </p>
    );
  return (
    <ul className={styles.list}>
      {block.list.map((item) => (
        <li key={item}>
          <Prose text={item} rtl={rtl} />
        </li>
      ))}
    </ul>
  );
}

/** A long-form legal page: title, last-updated date, contents with anchors, numbered sections. */
export function LegalDocument({ locale, doc }: { locale: Locale; doc: LegalDoc }) {
  const chrome = legalChrome[locale];
  const rtl = dir(locale) === "rtl";
  const updated = new Intl.DateTimeFormat(INTL_TAG[locale], {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(LEGAL_UPDATED));
  return (
    <main id="main" className="frame reveal">
      <article className={styles.doc}>
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {doc.title}
        </h1>
        <p className={styles.updated}>
          {chrome.updated}: <time dateTime={LEGAL_UPDATED}>{updated}</time>
        </p>
        <p className="lede">
          <Prose text={doc.lead} rtl={rtl} />
        </p>
        <nav aria-labelledby="legal-contents" className={styles.contents}>
          <h2 id="legal-contents" className={styles.contentsTitle}>
            {chrome.contents}
          </h2>
          <ol className={styles.contentsList}>
            {doc.sections.map((section) => (
              <li key={section.id}>
                <a className="text-link" href={`#${section.id}`}>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {doc.sections.map((section, i) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-title`}
            className={styles.section}
          >
            <h2 id={`${section.id}-title`} className={styles.sectionTitle}>
              <span className={styles.number}>{i + 1}.</span> {section.title}
            </h2>
            {section.blocks.map((block, j) => (
              <Block key={j} block={block} rtl={rtl} />
            ))}
          </section>
        ))}
        <p className={styles.contact}>
          <Link className="text-link" href={href(locale, paths.contact())}>
            {t(locale, "contactUs")}
          </Link>
        </p>
        <p className={styles.notice}>{chrome.notice}</p>
      </article>
    </main>
  );
}
