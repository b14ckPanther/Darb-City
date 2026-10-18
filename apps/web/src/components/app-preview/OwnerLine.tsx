import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@darb/core";
import { appPreview } from "@/content/app-preview";
import { showroom } from "@/content/showroom";
import { href, paths } from "@/lib/routes";
import styles from "./AppPreview.module.css";

/**
 * Under an ordinary business's screen, one quiet line for its owner: a glimpse of an app Darb
 * built and the way to have one. Visitors read past it; an owner looking at their plain card
 * sees what it could be.
 */
export function OwnerLine({ locale }: { locale: Locale }) {
  const copy = appPreview[locale].owner;
  const glimpse = showroom.en.clients[0]?.id;
  return (
    <p className={styles.owner} data-owner-line="">
      {glimpse ? (
        <span className={styles.glimpse} aria-hidden="true">
          <Image
            src={`/showroom/${glimpse}-phone.jpg`}
            alt=""
            width={780}
            height={1688}
            sizes="28px"
          />
        </span>
      ) : null}
      <span className={styles.ownerText}>
        <strong>{copy.question}</strong> {copy.body}
      </span>
      <Link className={styles.ownerLink} href={href(locale, paths.forBusiness())}>
        {copy.cta}
      </Link>
    </p>
  );
}
