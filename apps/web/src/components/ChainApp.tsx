import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@darb/core";
import { CHAIN_APPS } from "@/content/chain-apps";
import { href, paths } from "@/lib/routes";
import styles from "./ChainApp.module.css";

/**
 * What Darb built for this business's chain: "ours" on a Darb client of the chain, an invitation
 * on the chain's other listings. Nothing for a business outside a chain with an app.
 */
export function ChainApp({
  locale,
  brand,
  ours,
}: {
  locale: Locale;
  brand: string | null;
  ours: boolean;
}) {
  const app = brand ? CHAIN_APPS[brand]?.[locale] : undefined;
  if (!app) return null;
  const copy = ours ? app.ours : app.invite;
  const join = ours ? null : app.invite.join;
  const showroom = `${href(locale, paths.showroom())}#${app.showroom}`;
  return (
    <aside
      className={styles.panel}
      data-chain-app={ours ? "ours" : "invite"}
      aria-labelledby="chain-app-title"
    >
      <div className={styles.shots} aria-hidden="true">
        <Image
          className={styles.laptop}
          src={`/showroom/${app.showroom}-laptop.jpg`}
          alt=""
          width={1440}
          height={900}
          sizes="220px"
        />
        <Image
          className={styles.phone}
          src={`/showroom/${app.showroom}-phone.jpg`}
          alt=""
          width={780}
          height={1688}
          sizes="70px"
        />
      </div>
      <div className={styles.text}>
        <p className={styles.mark}>
          <span className={styles.dot} aria-hidden="true" />
          Darb · <bdi>{app.name}</bdi>
        </p>
        <h3 id="chain-app-title" className={styles.title}>
          {copy.title}
        </h3>
        <p className={styles.body}>{copy.body}</p>
        <p className={styles.actions}>
          <Link href={showroom} className={styles.primary}>
            {copy.open}
          </Link>
          {join ? (
            <Link
              href={`${href(locale, paths.contact())}?plan=signature`}
              className={styles.secondary}
            >
              {join}
            </Link>
          ) : null}
        </p>
      </div>
    </aside>
  );
}
