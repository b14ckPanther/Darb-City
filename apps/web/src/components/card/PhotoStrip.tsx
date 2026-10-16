"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Photos.module.css";

export interface PhotoLabels {
  photos: string;
  /** Templates: "Open photo {n}", "Photo {n} of {total}". */
  openPhoto: string;
  photoCount: string;
  previous: string;
  next: string;
  close: string;
}

const fill = (template: string, vars: Record<string, number>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/**
 * The owner's photos: a strip that scrolls sideways and snaps, small images loaded as they come
 * into view. A tap opens them large in a dialog that swipes (native scroll snap) and answers the
 * arrow keys in the page's reading direction. The images and icons arrive drawn (by the server on
 * the sheet), so this island ships only its behaviour.
 */
export function PhotoStrip({
  thumbs,
  slides: large,
  glyphs,
  labels,
}: {
  /** One small image per photo, and the same photos large, in order. */
  thumbs: ReactNode[];
  slides: ReactNode[];
  glyphs: { close: ReactNode; previous: ReactNode; next: ReactNode };
  labels: PhotoLabels;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const slides = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const total = thumbs.length;

  function show(i: number, smooth: boolean) {
    const target = (i + total) % total;
    const el = slides.current?.children[target] as HTMLElement | undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    el?.scrollIntoView?.({
      inline: "center",
      block: "nearest",
      behavior: smooth && !reduce ? "smooth" : "instant",
    });
    setIndex(target);
  }

  function open(i: number) {
    dialog.current?.showModal();
    show(i, false);
  }

  function onScroll() {
    const el = slides.current;
    if (el && el.clientWidth) setIndex(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    // The sheet closes on Escape too: this one closes the photos only.
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dialog.current?.close();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = (event.key === "ArrowRight") !== rtl;
    show(index + (forward ? 1 : -1), true);
  }

  if (!total) return null;
  return (
    <section className={styles.photos} aria-label={labels.photos} data-photo-strip="">
      <ul className={styles.strip}>
        {thumbs.map((thumb, i) => (
          <li key={i}>
            <button
              type="button"
              className={styles.thumb}
              onClick={() => open(i)}
              aria-label={fill(labels.openPhoto, { n: i + 1 })}
              aria-haspopup="dialog"
            >
              {thumb}
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        className={styles.lightbox}
        aria-label={labels.photos}
        onKeyDown={onKeyDown}
        data-lightbox=""
      >
        <div ref={slides} className={styles.slides} onScroll={onScroll}>
          {large.map((slide, i) => (
            <figure key={i} className={styles.slide}>
              {slide}
              <figcaption className="visually-hidden">
                {fill(labels.photoCount, { n: i + 1, total })}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className={styles.counter} aria-live="polite">
          {fill(labels.photoCount, { n: index + 1, total })}
        </p>
        <button
          type="button"
          className={styles.lightboxClose}
          onClick={() => dialog.current?.close()}
          aria-label={labels.close}
        >
          {glyphs.close}
        </button>
        {total > 1 ? (
          <>
            <button
              type="button"
              className={styles.prev}
              onClick={() => show(index - 1, true)}
              aria-label={labels.previous}
            >
              {glyphs.previous}
            </button>
            <button
              type="button"
              className={styles.next}
              onClick={() => show(index + 1, true)}
              aria-label={labels.next}
            >
              {glyphs.next}
            </button>
          </>
        ) : null}
      </dialog>
    </section>
  );
}
