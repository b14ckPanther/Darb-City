import { getImageProps } from "next/image";
import { MEDIA_ORIGIN } from "@/lib/csp";
import styles from "./Card.module.css";

/**
 * An image from the media bucket, filling its box. Bucket images get next/image's resized
 * sources (getImageProps: a plain <img>, no client JS), so a phone downloads a size near the box
 * and a 64 px logo never pulls the 512 px file. Anything else is a plain lazy image.
 */
export function CardImage({
  src,
  alt,
  sizes,
  contain = false,
  eager = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  /** Whole image, letterboxed (the photo viewer); otherwise it covers its box. */
  contain?: boolean;
  /** Above the fold (the logo): fetched at once rather than when scrolled to. */
  eager?: boolean;
}) {
  const className = contain ? styles.imgContain : styles.imgCover;
  const loading = eager ? ("eager" as const) : ("lazy" as const);
  const props = src.startsWith(`${MEDIA_ORIGIN}/`)
    ? getImageProps({ src, alt, fill: true, sizes, loading }).props
    : { src, alt, loading };
  // eslint-disable-next-line @next/next/no-img-element -- getImageProps gives the resized sources
  return <img {...props} alt={alt} className={className} decoding="async" />;
}
